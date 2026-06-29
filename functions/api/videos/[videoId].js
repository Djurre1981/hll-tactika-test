import { isAppVideoId, r2ObjectKey } from "../../lib/app-videos.js";
import { requireAuth } from "../../lib/auth-request.js";
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

  if (!context.env.VIDEOS_R2) {
    return errorResponse("Video storage is not configured", 503);
  }

  const object = await context.env.VIDEOS_R2.get(r2ObjectKey(videoId));
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
