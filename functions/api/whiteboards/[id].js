import { requireAuth } from "../../lib/auth-request.js";
import { canEnterEditorMode } from "../../lib/pin-permissions.js";
import { assertLinkedEventEditable } from "../../lib/event-component-link.js";
import {
  deleteWhiteboard,
  getWhiteboard,
  saveWhiteboard,
} from "../../lib/whiteboards-store.js";
import { errorResponse, json } from "../../lib/response.js";
import {
  assertToolContentEditable,
  canManageToolLock,
} from "../../lib/tool-lock.js";

function canModifyBoard(board, steamId, role) {
  if (role === "owner" || role === "admin" || role === "assist") return true;
  return board.createdBy === steamId;
}

function canDeleteBoard(board, steamId, role) {
  if (role === "owner" || role === "admin") return true;
  return board.createdBy === steamId;
}

export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  const id = context.params.id;
  try {
    const whiteboard = await getWhiteboard(context.env, id);
    if (!whiteboard) {
      return errorResponse("Whiteboard not found", 404);
    }
    return json({ whiteboard });
  } catch (error) {
    console.error("GET /api/whiteboards/:id failed:", error);
    return errorResponse("Whiteboard storage is not configured", 503);
  }
}

export async function onRequestPut(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  const id = context.params.id;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  try {
    const existing = await getWhiteboard(context.env, id);
    if (!existing) {
      return errorResponse("Whiteboard not found", 404);
    }

    if (!canModifyBoard(existing, auth.session.steamId, auth.role)) {
      return errorResponse("Not allowed to edit this whiteboard", 403);
    }

    if (body.lock === true || body.unlock === true) {
      if (!canManageToolLock(auth.session.steamId, auth.role, existing.createdBy)) {
        return errorResponse("Not allowed to change lock", 403);
      }
      const linked = await assertLinkedEventEditable(context.env, "whiteboard", id);
      if (linked.error) {
        return errorResponse(linked.error, linked.status || 423);
      }
      const whiteboard = await saveWhiteboard(context.env, {
        ...existing,
        locked: body.lock === true,
        lockedBy: body.lock === true ? auth.session.steamId : null,
        updatedAt: new Date().toISOString(),
      });
      return json({ whiteboard });
    }

    const input = body.whiteboard || {};
    const editable = assertToolContentEditable(existing, auth.session.steamId, auth.role, input);
    if (editable.error) {
      return errorResponse(editable.error, editable.status || 423);
    }

    const linked = await assertLinkedEventEditable(context.env, "whiteboard", id);
    if (linked.error) {
      return errorResponse(linked.error, linked.status || 423);
    }

    const title =
      typeof input.title === "string" && input.title.trim()
        ? input.title.trim().slice(0, 200)
        : existing.title;

    const next = {
      ...existing,
      title,
      mode: existing.mode,
      scene:
        input.scene && typeof input.scene === "object" ? input.scene : existing.scene,
      backgroundUrl:
        input.backgroundUrl !== undefined
          ? typeof input.backgroundUrl === "string" && input.backgroundUrl
            ? input.backgroundUrl
            : null
          : existing.backgroundUrl,
      updatedAt: new Date().toISOString(),
    };

    const whiteboard = await saveWhiteboard(context.env, next);
    return json({ whiteboard });
  } catch (error) {
    console.error("PUT /api/whiteboards/:id failed:", error);
    return errorResponse("Whiteboard storage is not configured", 503);
  }
}

export async function onRequestDelete(context) {
  const auth = await requireAuth(context);
  if (auth.error) {
    return auth.error;
  }

  if (!canEnterEditorMode(auth.role)) {
    return errorResponse("Editor access required", 403);
  }

  const id = context.params.id;

  try {
    const existing = await getWhiteboard(context.env, id);
    if (!existing) {
      return errorResponse("Whiteboard not found", 404);
    }

    if (!canDeleteBoard(existing, auth.session.steamId, auth.role)) {
      return errorResponse("Not allowed to delete this whiteboard", 403);
    }

    const linked = await assertLinkedEventEditable(context.env, "whiteboard", id);
    if (linked.error) {
      return errorResponse(linked.error, linked.status || 423);
    }

    await deleteWhiteboard(context.env, id);
    return json({ ok: true, id });
  } catch (error) {
    console.error("DELETE /api/whiteboards/:id failed:", error);
    return errorResponse("Whiteboard storage is not configured", 503);
  }
}
