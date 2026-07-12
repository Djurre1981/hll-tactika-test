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

export async function getR2VideoObject(env, videoId) {
  if (!env.VIDEOS_R2) {
    return null;
  }

  for (const key of videoR2LookupKeys(videoId)) {
    const object = await env.VIDEOS_R2.get(key);
    if (object) {
      return object;
    }
  }

  return null;
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
