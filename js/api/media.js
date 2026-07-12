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

export function uploadVideo(file) {
  return uploadFormRequest("/api/uploads/video", file);
}

export function uploadPreviewImage(file) {
  return uploadFormRequest("/api/uploads/image", file);
}
