import { isPlayableDirectUrl } from "./video.js";

const frameObjectUrlCache = new Map();

export function canExtractVideoFrame(url) {
  return isPlayableDirectUrl(url);
}

function revokeObjectUrl(url) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function captureVideoFrame(videoSource, { seekTime = null, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

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

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(video, 0, 0, width, height);
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

export async function fileFromVideoFrame(videoSource, filename = "preview.jpg") {
  const blob = await captureVideoFrame(videoSource);
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
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
  frameObjectUrlCache.set(cacheKey, objectUrl);
  return objectUrl;
}

export function clearVideoFrameCache() {
  for (const url of frameObjectUrlCache.values()) {
    revokeObjectUrl(url);
  }
  frameObjectUrlCache.clear();
}
