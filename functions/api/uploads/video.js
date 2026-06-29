import { requireAuth } from "../../lib/auth-request.js";
import { putUploadedVideo } from "../../lib/r2-media.js";
import { errorResponse, json } from "../../lib/response.js";

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
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

  const result = await putUploadedVideo(context.env, file);
  if (result.error) {
    return errorResponse(result.error, result.status || 400);
  }

  return json({ id: result.id, url: result.url }, { status: 201 });
}
