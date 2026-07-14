import { isAppImageId } from "../../lib/app-media.js";
import { guardAccess } from "../../lib/access-guard.js";
import { requireAuth } from "../../lib/auth-request.js";
import { getR2ImageObject } from "../../lib/r2-media.js";
import { errorResponse } from "../../lib/response.js";

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  // Images double as pin thumbnails — no bucket (rate limiting removed).
  const access = await guardAccess(context, {
    endpoint: "media.image",
    steamId: auth.session.steamId,
    steamName: auth.session.name,
  });
  if (access.error) {
    return access.error;
  }

  const imageId = String(context.params.imageId || "").trim();
  if (!isAppImageId(imageId)) {
    return errorResponse("Invalid image id", 400);
  }

  const object = await getR2ImageObject(context.env, imageId);
  if (!object) {
    return errorResponse("Image not found", 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", headers.get("Content-Type") || "image/jpeg");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(object.body, { headers });
}
