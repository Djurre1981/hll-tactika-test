import { isAppVideoId } from "../../lib/app-media.js";
import { requireAuth } from "../../lib/auth-request.js";
import { getR2VideoObject } from "../../lib/r2-media.js";
import { errorResponse } from "../../lib/response.js";

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  const videoId = String(context.params.videoId || "").trim();
  if (!isAppVideoId(videoId)) {
    return errorResponse("Invalid video id", 400);
  }

  const object = await getR2VideoObject(context.env, videoId);
  if (!object) {
    return errorResponse("Video not found", 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", headers.get("Content-Type") || "video/mp4");
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Accept-Ranges", "bytes");

  return new Response(object.body, { headers });
}
