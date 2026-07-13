import { requireAuth } from "../../../lib/auth-request.js";
import { canEnterEditorMode } from "../../../lib/pin-permissions.js";
import {
  fetchHllMapLookup,
  fetchStratSketchMetadata,
  parseStratSketchCode,
} from "../../../lib/stratsketch-client.js";
import { errorResponse, json } from "../../../lib/response.js";

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  const url = new URL(context.request.url).searchParams.get("url") || "";
  const code = parseStratSketchCode(url);
  if (!code) {
    return errorResponse("Invalid StratSketch URL or briefing code", 400);
  }

  try {
    const metadata = await fetchStratSketchMetadata(code);
    const maps = await fetchHllMapLookup();
    return json({
      metadata: {
        code: metadata.code,
        name: metadata.name,
        host: metadata.host,
        revision: metadata.revision,
        game: metadata.game,
        screenshotUrl: metadata.screenshotUrl,
        creatorUsername: metadata.creatorUsername,
        createdAt: metadata.createdAt,
      },
      maps: [...maps.entries()].map(([id, name]) => ({ id, name })),
    });
  } catch (error) {
    console.error("StratSketch metadata fetch failed:", error);
    return errorResponse(error.message || "Could not load StratSketch briefing metadata", 502);
  }
}
