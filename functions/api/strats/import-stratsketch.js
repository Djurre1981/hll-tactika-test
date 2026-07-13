import { requireAuth } from "../../lib/auth-request.js";
import { resolveCreatorName } from "../../lib/pin-creators.js";
import { canEnterEditorMode } from "../../lib/pin-permissions.js";
import { sanitizeStratInput } from "../../lib/strat-fields.js";
import { fetchStratSketchExport, parseStratSketchCode } from "../../lib/stratsketch-client.js";
import { convertStratSketchBriefing } from "../../lib/stratsketch-convert.js";
import { loadStratsData, saveStratsData } from "../../lib/strats-store.js";
import { errorResponse, json } from "../../lib/response.js";

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

  const url = String(body.url || "").trim();
  if (!parseStratSketchCode(url)) {
    return errorResponse("Invalid StratSketch URL or briefing code", 400);
  }

  try {
    const exported = await fetchStratSketchExport(url);
    const converted = convertStratSketchBriefing(exported.briefing);
    const createdByName = await resolveCreatorName(
      auth.session.steamId,
      context.env,
      auth.session
    );

    const now = new Date().toISOString();
    const built = sanitizeStratInput({
      ...converted,
      title: String(body.title || converted.title).trim() || converted.title,
      locked: false,
      lockedBy: null,
    }, { requireSlides: true });

    if (built.error) {
      return errorResponse(built.error, 400);
    }

    const strat = {
      ...built.strat,
      id: `strat-${crypto.randomUUID()}`,
      createdBy: auth.session.steamId,
      createdByName,
      createdAt: now,
      updatedAt: now,
      importSource: {
        type: "stratsketch",
        code: exported.metadata.code,
        revision: exported.metadata.revision,
        importMode: "png",
        ssTitle: exported.metadata.name,
        ssCreator: exported.metadata.creatorUsername,
        ssCreatedAt: exported.metadata.createdAt,
        importedAt: now,
      },
    };

    const data = await loadStratsData(context.env);
    data.strats.push(strat);
    await saveStratsData(context.env, data);

    return json({
      strat,
      import: {
        source: "stratsketch",
        code: exported.metadata.code,
        slideCount: strat.slides.length,
        objectCount: strat.slides.reduce((sum, slide) => sum + (slide.objects?.length || 0), 0),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("StratSketch import failed:", error);
    return errorResponse(error.message || "StratSketch import failed", 502);
  }
}
