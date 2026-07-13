import {
  appImageUrl,
  appVideoUrl,
  imageR2LookupKeys,
  newUploadMediaId,
  r2ImageKey,
  r2UploadedVideoKey,
  resolveImageUpload,
  resolveVideoUpload,
  videoR2LookupKeys,
} from "./app-media.js";

export async function putUploadedVideo(env, file) {
  const resolved = resolveVideoUpload(file);
  if (resolved.error) {
    return { error: resolved.error };
  }

  if (!env.VIDEOS_R2) {
    return { error: "Video storage is not configured", status: 503 };
  }

  const id = newUploadMediaId();
  await env.VIDEOS_R2.put(r2UploadedVideoKey(id), file.stream(), {
    httpMetadata: { contentType: resolved.contentType },
    customMetadata: { extension: resolved.extension },
  });

  return { id, url: appVideoUrl(id) };
}

export async function putUploadedImage(env, file) {
  const resolved = resolveImageUpload(file);
  if (resolved.error) {
    return { error: resolved.error };
  }

  if (!env.VIDEOS_R2) {
    return { error: "Media storage is not configured", status: 503 };
  }

  const id = newUploadMediaId();
  await env.VIDEOS_R2.put(r2ImageKey(id), file.stream(), {
    httpMetadata: { contentType: resolved.contentType },
    customMetadata: { extension: resolved.extension },
  });

  return { id, url: appImageUrl(id) };
}

export async function headR2VideoObject(env, videoId) {
  if (!env.VIDEOS_R2) {
    return null;
  }

  for (const key of videoR2LookupKeys(videoId)) {
    const object = await env.VIDEOS_R2.head(key);
    if (object) {
      return object;
    }
  }

  return null;
}

export async function getR2VideoObject(env, videoId, getOptions = undefined) {
  if (!env.VIDEOS_R2) {
    return null;
  }

  for (const key of videoR2LookupKeys(videoId)) {
    const object = getOptions
      ? await env.VIDEOS_R2.get(key, getOptions)
      : await env.VIDEOS_R2.get(key);
    if (object) {
      return object;
    }
  }

  return null;
}

/**
 * Parse a single HTTP Range header against object size.
 * @returns {{ offset?: number, length?: number, suffix?: number } | null | { error: 416 }}
 */
export function parseBytesRange(rangeHeader, size) {
  if (!rangeHeader) {
    return null;
  }

  const trimmed = String(rangeHeader).trim();
  if (!trimmed.toLowerCase().startsWith("bytes=") || trimmed.includes(",")) {
    return { error: 416 };
  }

  const spec = trimmed.slice(6);
  const dash = spec.indexOf("-");
  if (dash < 0) {
    return { error: 416 };
  }

  const startStr = spec.slice(0, dash);
  const endStr = spec.slice(dash + 1);

  if (startStr === "" && endStr === "") {
    return { error: 416 };
  }

  if (startStr === "") {
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return { error: 416 };
    }
    return { suffix };
  }

  const offset = Number(startStr);
  if (!Number.isFinite(offset) || offset < 0 || offset >= size) {
    return { error: 416 };
  }

  if (endStr === "") {
    return { offset };
  }

  const end = Number(endStr);
  if (!Number.isFinite(end) || end < offset) {
    return { error: 416 };
  }

  const cappedEnd = Math.min(end, size - 1);
  return { offset, length: cappedEnd - offset + 1 };
}

export async function getR2ImageObject(env, imageId) {
  if (!env.VIDEOS_R2) {
    return null;
  }

  for (const key of imageR2LookupKeys(imageId)) {
    const object = await env.VIDEOS_R2.get(key);
    if (object) {
      return object;
    }
  }

  return null;
}
