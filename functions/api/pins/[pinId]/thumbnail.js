import { requireAuth } from "../../../lib/auth-request.js";
import {
  isDirectImageUrl,
  isPersistableThumbnailUrl,
  pinHasCompactSilentThumbnail,
  pinHasDirectImage,
  pinHasDirectPlayableVideo,
  pinHasSupportedVideo,
} from "../../../lib/media-urls.js";
import { isValidMapId } from "../../../lib/pin-fields.js";
import { findPin, loadPinsData, upsertPin } from "../../../lib/pins-store.js";
import { putUploadedImage } from "../../../lib/r2-media.js";
import { errorResponse, json } from "../../../lib/response.js";

/** Compact JPEG stills only — not a path for full media uploads. */
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

async function applyThumbnailIfEmpty(env, mapId, pinId, thumbnailUrl) {
  const fresh = await loadPinsData(env);
  const latest = findPin(fresh, mapId, pinId);
  if (!latest) {
    return { error: "Pin not found", status: 404 };
  }

  if (pinHasCompactSilentThumbnail(latest.pin)) {
    return {
      thumbnail: String(latest.pin.thumbnail).trim(),
      pin: latest.pin,
      alreadySet: true,
    };
  }

  latest.pin.thumbnail = thumbnailUrl;
  try {
    await upsertPin(env, mapId, latest.pin);
  } catch (error) {
    console.error(error);
    return { error: "Pin storage is not configured", status: 503 };
  }

  return { thumbnail: thumbnailUrl, pin: latest.pin, alreadySet: false };
}

/**
 * Fill-if-empty compact thumbnail (editor/explicit use).
 * Browse preview should not call this — keep pin writes off the navigate path.
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

  const data = await loadPinsData(context.env);
  const found = findPin(data, mapId, pinId);
  if (!found) {
    return errorResponse("Pin not found", 404);
  }

  if (pinHasCompactSilentThumbnail(found.pin)) {
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

  const canUploadStill =
    pinHasDirectPlayableVideo(found.pin) || pinHasDirectImage(found.pin);
  if (!canUploadStill) {
    return errorResponse("Pin has no media to thumbnail", 400);
  }

  if (!file) {
    return errorResponse("Provide file or thumbnailUrl", 400);
  }

  if (typeof file.size === "number" && file.size > MAX_THUMBNAIL_BYTES) {
    return errorResponse("Thumbnail file too large (max 2MB)", 400);
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
