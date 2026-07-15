const DISCORD_VIDEO_ID = /^\d{17,20}$/;
const UPLOAD_MEDIA_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const VIDEO_EXTENSIONS = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogg: "video/ogg",
};

export const IMAGE_EXTENSIONS = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export function isUploadMediaId(id) {
  return UPLOAD_MEDIA_ID.test(String(id || "").trim());
}

export function isDiscordVideoId(id) {
  return DISCORD_VIDEO_ID.test(String(id || "").trim());
}

export function isAppVideoId(videoId) {
  const id = String(videoId || "").trim();
  return isDiscordVideoId(id) || isUploadMediaId(id);
}

export function isAppImageId(imageId) {
  const id = String(imageId || "").trim();
  return isUploadMediaId(id) || isDiscordVideoId(id);
}

export function appVideoUrl(videoId) {
  return `/api/videos/${String(videoId).trim()}`;
}

export function appImageUrl(imageId) {
  return `/api/images/${String(imageId).trim()}`;
}

export function legacyDiscordR2VideoKey(videoId) {
  return `tricks/${String(videoId).trim()}.mp4`;
}

export function r2UploadedVideoKey(videoId) {
  return `videos/${String(videoId).trim()}`;
}

export function r2ImageKey(imageId) {
  return `images/${String(imageId).trim()}`;
}

export function discordVideoR2Key(attachmentId) {
  return `discord/${String(attachmentId).trim()}`;
}

export function discordImageR2Key(attachmentId) {
  return `discord-images/${String(attachmentId).trim()}`;
}

export function videoR2LookupKeys(videoId) {
  const id = String(videoId || "").trim();
  if (isDiscordVideoId(id)) {
    return [discordVideoR2Key(id), legacyDiscordR2VideoKey(id)];
  }
  if (isUploadMediaId(id)) {
    return [r2UploadedVideoKey(id)];
  }
  return [];
}

export function imageR2LookupKeys(imageId) {
  const id = String(imageId || "").trim();
  if (isDiscordVideoId(id)) {
    return [discordImageR2Key(id)];
  }
  if (isUploadMediaId(id)) {
    return [r2ImageKey(id)];
  }
  return [];
}

function toPathname(url) {
  try {
    if (url.startsWith("/")) {
      return url.split("?")[0];
    }
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return "";
  }
}

export function isAppVideoPath(url) {
  if (!url) return false;
  const match = toPathname(url).match(/^\/api\/videos\/([^/]+)$/);
  return Boolean(match && isAppVideoId(match[1]));
}

export function isAppImagePath(url) {
  if (!url) return false;
  const match = toPathname(url).match(/^\/api\/images\/([^/]+)$/);
  return Boolean(match && isAppImageId(match[1]));
}

export function appImageIdFromUrl(url) {
  if (!url) return null;
  const match = toPathname(String(url).trim()).match(/^\/api\/images\/([^/]+)$/);
  if (!match || !isAppImageId(match[1])) return null;
  return match[1];
}

export function extensionFromFilename(name) {
  const match = String(name || "")
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

export function resolveVideoUpload(file) {
  const extension = extensionFromFilename(file.name);
  const contentType = VIDEO_EXTENSIONS[extension];
  if (!contentType) {
    return {
      error: "Unsupported video format. Use MP4, WebM, MOV, or OGG.",
    };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return { error: "Video is too large (max 80 MB)." };
  }
  return { extension, contentType };
}

export function resolveImageUpload(file) {
  const extension = extensionFromFilename(file.name);
  const contentType = IMAGE_EXTENSIONS[extension];
  if (!contentType) {
    return {
      error: "Unsupported image format. Use JPEG, PNG, WebP, or GIF.",
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Image is too large (max 12 MB)." };
  }
  return { extension, contentType };
}

export function newUploadMediaId() {
  return crypto.randomUUID();
}

export { extractDiscordAttachmentId, isDiscordMediaUrl } from "./discord-url.js";
