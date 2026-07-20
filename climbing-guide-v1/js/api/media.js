import { fileLooksLikeHevc } from "../utils/video-hevc.js";

const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

async function uploadFormRequest(url, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Upload failed (${response.status})`);
  }

  return data;
}

/**
 * Upload a video. HEVC/H.265 files are converted to H.264 in the browser first
 * so they play in Chrome/Firefox without a codec pack.
 *
 * @param {File} file
 * @param {{ onStatus?: (label: string) => void }} [options]
 * @returns {Promise<{ id: string, url: string, file: File }>}
 */
export async function uploadVideo(file, options = {}) {
  let prepared = file;

  if (await fileLooksLikeHevc(file)) {
    options.onStatus?.("Converting to H.264…");
    const { ensureH264UploadFile } = await import("../utils/video-transcode.js");
    prepared = await ensureH264UploadFile(file, {
      maxBytes: MAX_VIDEO_BYTES,
      onStatus: options.onStatus,
      alreadyDetected: true,
    });
  }

  if (prepared.size > MAX_VIDEO_BYTES) {
    throw new Error("Video is too large (max 80 MB).");
  }

  options.onStatus?.("Uploading…");
  const data = await uploadFormRequest("/api/uploads/video", prepared);
  return { ...data, file: prepared };
}

export function uploadPreviewImage(file) {
  return uploadFormRequest("/api/uploads/image", file);
}
