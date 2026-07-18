import { requireAuth } from "../lib/auth-request.js";
import { resolveCreatorName } from "../lib/pin-creators.js";
import { canEnterEditorMode } from "../lib/pin-permissions.js";
import {
  createWhiteboard,
  listWhiteboards,
  normalizeBoardMode,
} from "../lib/whiteboards-store.js";
import { errorResponse, json } from "../lib/response.js";

function boardListItem(board) {
  return {
    id: board.id,
    title: board.title,
    mode: board.mode,
    backgroundUrl: board.backgroundUrl || null,
    createdBy: board.createdBy,
    createdByName: board.createdByName,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
  };
}

function emptySlideshowScene() {
  const id = `slide-${crypto.randomUUID()}`;
  return {
    slides: [
      {
        id,
        name: "Slide 1",
        order: 0,
        elements: [],
        appState: { theme: "dark" },
        files: {},
      },
    ],
  };
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  try {
    const lightweight = new URL(context.request.url).searchParams.get("meta") === "1";
    const boards = await listWhiteboards(context.env, { meta: lightweight });
    return json({
      whiteboards: lightweight ? boards.map(boardListItem) : boards,
    });
  } catch (error) {
    console.error("GET /api/whiteboards failed:", error);
    return errorResponse("Whiteboard storage is not configured", 503);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const input = body.whiteboard || {};
  const mode = normalizeBoardMode(input.mode);
  const title =
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim().slice(0, 200)
      : mode === "slideshow"
        ? "Untitled Slideshow"
        : "Untitled Board";

  const createdByName = await resolveCreatorName(
    auth.session.steamId,
    context.env,
    auth.session
  );

  const defaultScene =
    mode === "slideshow"
      ? emptySlideshowScene()
      : { elements: [], appState: { theme: "dark" }, files: {} };

  const now = new Date().toISOString();
  const board = {
    id: input.id || `wb-${crypto.randomUUID()}`,
    title,
    mode,
    scene:
      input.scene && typeof input.scene === "object" ? input.scene : defaultScene,
    backgroundUrl:
      typeof input.backgroundUrl === "string" && input.backgroundUrl
        ? input.backgroundUrl
        : null,
    createdBy: auth.session.steamId,
    createdByName,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const whiteboard = await createWhiteboard(context.env, board);
    return json({ whiteboard }, { status: 201 });
  } catch (error) {
    console.error("POST /api/whiteboards failed:", error);
    return errorResponse("Whiteboard storage is not configured", 503);
  }
}
