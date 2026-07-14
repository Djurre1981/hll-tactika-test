import { guardAccess } from "../../../lib/access-guard.js";
import { requireAuth } from "../../../lib/auth-request.js";
import {
  isDirectImageUrl,
  pinHasDirectPlayableVideo,
  pinHasImageThumbnail,
} from "../../../lib/media-urls.js";
import { isValidMapId } from "../../../lib/pin-fields.js";
import { findPin, loadPinsData, savePinsData } from "../../../lib/pins-store.js";
import { putUploadedImage } from "../../../lib/r2-media.js";
import { errorResponse, json } from "../../../lib/response.js";

/**
 * Fill-if-empty thumbnail backfill for direct/playable videos.
 * Any signed-in member may upload a still when the pin has no image thumbnail yet.
 * Does not overwrite an existing image thumbnail or reopen full pin edit.
 */
export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  const pinId = String(context.params.pinId || "").trim();
  if (!pinId) {
    return errorResponse("pinId is required", 400);
  }

  let formData;
  try {
    formData = await context.request.formData();
  } catch {
    return errorResponse("Expected multipart form data", 400);
  }

  const mapId = String(formData.get("mapId") || "").trim();
  if (!mapId) {
    return errorResponse("mapId is required", 400);
  }
  if (!isValidMapId(mapId)) {
    return errorResponse("Invalid mapId", 400);
  }

  const access = await guardAccess(context, {
    bucket: "upload",
    endpoint: "pins.thumbnail",
    steamId: auth.session.steamId,
    steamName: auth.session.name,
    mapId,
    pinId,
    statusOnSuccess: 200,
  });
  if (access.error) {
    return access.error;
  }

  const data = await loadPinsData(context.env);
  const found = findPin(data, mapId, pinId);
  if (!found) {
    return errorResponse("Pin not found", 404);
  }

  if (pinHasImageThumbnail(found.pin)) {
    return json({
      thumbnail: String(found.pin.thumbnail).trim(),
      pin: found.pin,
      alreadySet: true,
    });
  }

  if (!pinHasDirectPlayableVideo(found.pin)) {
    return errorResponse("Pin has no direct video to thumbnail", 400);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return errorResponse('Missing file field "file"', 400);
  }

  const result = await putUploadedImage(context.env, file);
  if (result.error) {
    return errorResponse(result.error, result.status || 400);
  }

  if (!isDirectImageUrl(result.url)) {
    return errorResponse("Uploaded file is not a usable thumbnail", 400);
  }

  // Re-check after upload so concurrent fills stay idempotent.
  const fresh = await loadPinsData(context.env);
  const latest = findPin(fresh, mapId, pinId);
  if (!latest) {
    return errorResponse("Pin not found", 404);
  }

  if (pinHasImageThumbnail(latest.pin)) {
    return json({
      thumbnail: String(latest.pin.thumbnail).trim(),
      pin: latest.pin,
      alreadySet: true,
    });
  }

  latest.pin.thumbnail = result.url;
  try {
    await savePinsData(context.env, fresh);
  } catch (error) {
    console.error(error);
    return errorResponse("Pin storage is not configured", 503);
  }

  return json({ thumbnail: result.url, pin: latest.pin, alreadySet: false });
}
