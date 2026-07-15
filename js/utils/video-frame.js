import { isPlayableDirectUrl } from "./video.js";

const frameObjectUrlCache = new Map();
const MAX_FRAME_CACHE = 24;

function touchFrameCache(key, objectUrl) {
  if (frameObjectUrlCache.has(key)) {
    frameObjectUrlCache.delete(key);
  }
  frameObjectUrlCache.set(key, objectUrl);
  while (frameObjectUrlCache.size > MAX_FRAME_CACHE) {
    const oldest = frameObjectUrlCache.keys().next().value;
    revokeObjectUrl(frameObjectUrlCache.get(oldest));
    frameObjectUrlCache.delete(oldest);
  }
}

export function canExtractVideoFrame(url) {
  return isPlayableDirectUrl(url);
}

function revokeObjectUrl(url) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function fitCanvasSize(width, height, maxEdge) {
  if (!maxEdge || maxEdge <= 0) {
    return { width, height };
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function captureVideoFrame(
  videoSource,
  { seekTime = null, quality = 0.85, maxEdge = null } = {}
) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    let objectUrl = null;
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };

    const fail = (message) => {
      cleanup();
      reject(new Error(message));
    };

    video.addEventListener("error", () => fail("Could not load video for preview"), { once: true });

    video.addEventListener(
      "loadeddata",
      () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const target =
          seekTime === null ? Math.min(0.1, duration > 0 ? duration * 0.01 : 0.1) : seekTime;
        video.currentTime = target;
      },
      { once: true }
    );

    video.addEventListener(
      "seeked",
      () => {
        try {
          const width = video.videoWidth;
          const height = video.videoHeight;
          if (!width || !height) {
            fail("Video has no readable frame");
            return;
          }

          const size = fitCanvasSize(width, height, maxEdge);
          const canvas = document.createElement("canvas");
          canvas.width = size.width;
          canvas.height = size.height;
          canvas.getContext("2d").drawImage(video, 0, 0, size.width, size.height);
          canvas.toBlob(
            (blob) => {
              cleanup();
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Could not capture video frame"));
              }
            },
            "image/jpeg",
            quality
          );
        } catch (error) {
          fail(error.message || "Could not capture video frame");
        }
      },
      { once: true }
    );

    if (videoSource instanceof Blob) {
      objectUrl = URL.createObjectURL(videoSource);
      video.src = objectUrl;
    } else {
      video.src = String(videoSource);
    }

    video.load();
  });
}

/** Longest edge for JPEGs persisted to R2 (editor save + hover backfill). */
export const PERSISTED_THUMB_MAX_EDGE = 360;

export const PERSISTED_THUMB_QUALITY = 0.75;

function canvasToJpegFile(canvas, filename, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not encode JPEG thumbnail"));
          return;
        }
        resolve(new File([blob], filename, { type: blob.type || "image/jpeg" }));
      },
      "image/jpeg",
      quality
    );
  });
}

export async function fileFromVideoFrame(
  videoSource,
  filename = "preview.jpg",
  { quality = PERSISTED_THUMB_QUALITY, maxEdge = PERSISTED_THUMB_MAX_EDGE } = {}
) {
  const blob = await captureVideoFrame(videoSource, { quality, maxEdge });
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

/** Downscale an image URL / Blob / File to a compact JPEG for pin.thumbnail. */
export async function fileFromImageSource(
  imageSource,
  filename = "preview.jpg",
  { quality = PERSISTED_THUMB_QUALITY, maxEdge = PERSISTED_THUMB_MAX_EDGE } = {}
) {
  const img = new Image();
  img.decoding = "async";
  let objectUrl = null;

  try {
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not load image for thumbnail"));
      if (imageSource instanceof Blob) {
        objectUrl = URL.createObjectURL(imageSource);
        img.crossOrigin = "anonymous";
        img.src = objectUrl;
      } else {
        img.crossOrigin = "anonymous";
        img.src = String(imageSource);
      }
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) {
      throw new Error("Image has no readable dimensions");
    }

    const size = fitCanvasSize(width, height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext("2d").drawImage(img, 0, 0, size.width, size.height);
    return canvasToJpegFile(canvas, filename, quality);
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

export async function getVideoFrameObjectUrl(videoSource) {
  const cacheKey =
    videoSource instanceof Blob
      ? `${videoSource.name}:${videoSource.size}:${videoSource.lastModified}`
      : String(videoSource);

  const cached = frameObjectUrlCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const blob = await captureVideoFrame(videoSource);
  const objectUrl = URL.createObjectURL(blob);
  touchFrameCache(cacheKey, objectUrl);
  return objectUrl;
}

export function clearVideoFrameCache() {
  for (const url of frameObjectUrlCache.values()) {
    revokeObjectUrl(url);
  }
  frameObjectUrlCache.clear();
}
