import { guardAccess } from "../../../lib/access-guard.js";
import { requireAuth } from "../../../lib/auth-request.js";
import {
  isDirectImageUrl,
  isPersistableThumbnailUrl,
  pinHasDirectPlayableVideo,
  pinHasImageThumbnail,
  pinHasSupportedVideo,
} from "../../../lib/media-urls.js";
import { isValidMapId } from "../../../lib/pin-fields.js";
import { findPin, loadPinsData, savePinsData } from "../../../lib/pins-store.js";
import { putUploadedImage } from "../../../lib/r2-media.js";
import { errorResponse, json } from "../../../lib/response.js";

async function applyThumbnailIfEmpty(env, mapId, pinId, thumbnailUrl) {
  const fresh = await loadPinsData(env);
  const latest = findPin(fresh, mapId, pinId);
  if (!latest) {
    return { error: "Pin not found", status: 404 };
  }

  if (pinHasImageThumbnail(latest.pin)) {
    return {
      thumbnail: String(latest.pin.thumbnail).trim(),
      pin: latest.pin,
      alreadySet: true,
    };
  }

  latest.pin.thumbnail = thumbnailUrl;
  try {
    await savePinsData(env, fresh);
  } catch (error) {
    console.error(error);
    return { error: "Pin storage is not configured", status: 503 };
  }

  return { thumbnail: thumbnailUrl, pin: latest.pin, alreadySet: false };
}

/**
 * Fill-if-empty thumbnail backfill.
 * Any signed-in member may set a still when the pin has no image thumbnail yet:
 * - multipart `file` for captured frames from direct videos
 * - `thumbnailUrl` for YouTube/Medal (and other persistable image) CDN stills
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

  const contentType = context.request.headers.get("content-type") || "";
  let mapId = "";
  let file = null;
  let thumbnailUrl = "";

  if (contentType.includes("application/json")) {
    let body;
    try {
      body = await context.request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }
    mapId = String(body?.mapId || "").trim();
    thumbnailUrl = String(body?.thumbnailUrl || "").trim();
  } else {
    let formData;
    try {
      formData = await context.request.formData();
    } catch {
      return errorResponse("Expected multipart form data or JSON", 400);
    }
    mapId = String(formData.get("mapId") || "").trim();
    thumbnailUrl = String(formData.get("thumbnailUrl") || "").trim();
    file = formData.get("file");
    if (typeof file === "string") {
      file = null;
    }
  }

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

  if (thumbnailUrl) {
    if (!isPersistableThumbnailUrl(thumbnailUrl)) {
      return errorResponse("Unsupported thumbnail URL", 400);
    }
    if (!pinHasSupportedVideo(found.pin)) {
      return errorResponse("Pin has no video to thumbnail", 400);
    }
    const applied = await applyThumbnailIfEmpty(
      context.env,
      mapId,
      pinId,
      thumbnailUrl
    );
    if (applied.error) {
      return errorResponse(applied.error, applied.status || 400);
    }
    return json(applied);
  }

  if (!pinHasDirectPlayableVideo(found.pin)) {
    return errorResponse("Pin has no direct video to thumbnail", 400);
  }

  if (!file) {
    return errorResponse('Provide file or thumbnailUrl', 400);
  }

  const result = await putUploadedImage(context.env, file);
  if (result.error) {
    return errorResponse(result.error, result.status || 400);
  }

  if (!isDirectImageUrl(result.url)) {
    return errorResponse("Uploaded file is not a usable thumbnail", 400);
  }

  const applied = await applyThumbnailIfEmpty(
    context.env,
    mapId,
    pinId,
    result.url
  );
  if (applied.error) {
    return errorResponse(applied.error, applied.status || 400);
  }
  return json(applied);
}
