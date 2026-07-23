const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_DIMENSION = 4096;

/**
 * Validate and optionally downscale an image before upload.
 * @returns {Promise<{ file: File, warning?: string }>}
 */
export async function prepareImageUpload(file) {
  if (!file || !(file instanceof Blob)) {
    throw new Error("No image selected.");
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error("Unsupported format. Use JPEG, PNG, WebP, or GIF.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image is too large (max 12 MB).");
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const maxDim = Math.max(width, height);

  if (maxDim <= MAX_DIMENSION) {
    bitmap.close();
    return { file };
  }

  const scale = MAX_DIMENSION / maxDim;
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, outW, outH);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process image."))),
      file.type === "image/png" ? "image/png" : "image/jpeg",
      file.type === "image/png" ? undefined : 0.92
    );
  });

  const ext =
    blob.type === "image/png"
      ? "png"
      : blob.type === "image/webp"
        ? "webp"
        : "jpg";
  const baseName = String(file.name || "background").replace(/\.[^.]+$/, "");
  const outFile = new File([blob], `${baseName}-scaled.${ext}`, { type: blob.type });

  if (outFile.size > MAX_BYTES) {
    throw new Error("Image is still too large after scaling (max 12 MB).");
  }

  return {
    file: outFile,
    warning: `Image was scaled down to ${outW}×${outH}px to fit upload limits.`,
  };
}

/**
 * Upload a prepared image file to R2 via the shared API.
 * @returns {Promise<string>} public `/api/images/{id}` URL
 */
export async function uploadImageFile(file, apiClient) {
  const form = new FormData();
  form.append("file", file);
  const result = await apiClient("/uploads/image", { method: "POST", body: form });
  if (!result?.url) {
    throw new Error("Upload failed — no URL returned.");
  }
  return result.url;
}
