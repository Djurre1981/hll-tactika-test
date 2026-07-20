import { canEnterEditorMode } from "../../lib/pin-permissions.js";
import { requireAuth } from "../../lib/auth-request.js";
import { uploadedFileLooksLikeHevc } from "../../lib/mp4-hevc.js";
import { putUploadedVideo } from "../../lib/r2-media.js";
import { errorResponse, json } from "../../lib/response.js";

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  let formData;
  try {
    formData = await context.request.formData();
  } catch {
    return errorResponse("Expected multipart form data", 400);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return errorResponse('Missing file field "file"', 400);
  }

  // Client converts HEVC → H.264 before upload; reject leftovers so they
  // never land in R2 (Chrome/Firefox often cannot play HEVC in <video>).
  if (await uploadedFileLooksLikeHevc(file)) {
    return errorResponse(
      "HEVC/H.265 video is not supported. Convert to H.264 (MP4) and try again.",
      415
    );
  }

  const result = await putUploadedVideo(context.env, file);
  if (result.error) {
    return errorResponse(result.error, result.status || 400);
  }

  return json({ id: result.id, url: result.url }, { status: 201 });
}
