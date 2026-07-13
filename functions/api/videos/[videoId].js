import { isAppVideoId } from "../../lib/app-media.js";
import { guardAccess } from "../../lib/access-guard.js";
import { requireAuth } from "../../lib/auth-request.js";
import {
  getR2VideoObject,
  headR2VideoObject,
  parseBytesRange,
} from "../../lib/r2-media.js";
import { errorResponse } from "../../lib/response.js";

function videoNotSatisfiable(size) {
  return new Response(null, {
    status: 416,
    headers: {
      "Content-Range": `bytes */${size}`,
      "Accept-Ranges": "bytes",
    },
  });
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  const access = await guardAccess(context, {
    bucket: "media",
    endpoint: "media.video",
    steamId: auth.session.steamId,
    steamName: auth.session.name,
  });
  if (access.error) {
    return access.error;
  }

  const videoId = String(context.params.videoId || "").trim();
  if (!isAppVideoId(videoId)) {
    return errorResponse("Invalid video id", 400);
  }

  const rangeHeader = context.request.headers.get("Range");
  let object;
  let status = 200;

  if (rangeHeader) {
    const head = await headR2VideoObject(context.env, videoId);
    if (!head) {
      return errorResponse("Video not found", 404);
    }

    const parsed = parseBytesRange(rangeHeader, head.size);
    if (parsed?.error === 416) {
      return videoNotSatisfiable(head.size);
    }

    object = await getR2VideoObject(context.env, videoId, { range: parsed });
    if (!object) {
      return errorResponse("Video not found", 404);
    }
    status = 206;
  } else {
    object = await getR2VideoObject(context.env, videoId);
    if (!object) {
      return errorResponse("Video not found", 404);
    }
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", headers.get("Content-Type") || "video/mp4");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Accept-Ranges", "bytes");

  if (status === 206) {
    const range = object.range;
    let start;
    let end;
    if (range && typeof range.offset === "number") {
      start = range.offset;
      const length =
        typeof range.length === "number"
          ? range.length
          : Math.max(0, object.size - start);
      end = start + length - 1;
    } else if (range && typeof range.suffix === "number") {
      start = Math.max(0, object.size - range.suffix);
      end = object.size - 1;
    } else {
      const parsed = parseBytesRange(rangeHeader, object.size);
      if (parsed?.suffix) {
        start = Math.max(0, object.size - parsed.suffix);
        end = object.size - 1;
      } else if (parsed && typeof parsed.offset === "number") {
        start = parsed.offset;
        const length =
          typeof parsed.length === "number"
            ? parsed.length
            : object.size - start;
        end = start + length - 1;
      } else {
        return videoNotSatisfiable(object.size);
      }
    }

    headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`);
    headers.set("Content-Length", String(end - start + 1));
  }

  return new Response(object.body, { status, headers });
}
