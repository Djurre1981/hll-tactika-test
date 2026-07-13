import { decodeDataMessages } from "./stratsketch-binary.js";
import { resolveStratSketchCreator } from "./stratsketch-metadata.js";
import { convertStratSketchBriefingToPngSlides, convertConvertedSlidesToPngSlides } from "./stratsketch-png-import.js";
import {
  fetchStratSketchImportMetadata,
} from "../api/strats.js";

const LIVE_VERSION = "2";
const STRATSKETCH_ORIGIN = "https://stratsketch.com";

export function parseStratSketchCode(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;
  if (/^[A-Za-z0-9_-]{6,}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `${STRATSKETCH_ORIGIN}/${trimmed}`);
    if (!url.hostname.endsWith("stratsketch.com")) return null;
    const code = url.pathname.split("/").filter(Boolean)[0];
    return code || null;
  } catch {
    return null;
  }
}

function briefingUrlForInput(urlOrCode) {
  const code = parseStratSketchCode(urlOrCode);
  return code ? `${STRATSKETCH_ORIGIN}/${code}` : null;
}

function mergeSlides(slides) {
  const byId = new Map();
  for (const slide of slides) {
    const existing = byId.get(slide.id);
    if (!existing) {
      byId.set(slide.id, { ...slide, entities: [...slide.entities] });
      continue;
    }
    existing.name = slide.name || existing.name;
    existing.mapName = slide.mapName || existing.mapName;
    existing.entities.push(...slide.entities);
  }
  return [...byId.values()];
}

function enrichMetadata(metadata, source) {
  const creatorUsername = metadata.creatorUsername
    || resolveStratSketchCreator(source?.persistedUsers);
  return {
    ...metadata,
    name: source?.name || source?.title || metadata.name,
    creatorUsername,
    slideCount: source?.slides?.length || metadata.slideCount || null,
  };
}

function formatBrowserWsFailure(event) {
  if (event.code === 4001) {
    const briefingUrl = event.briefingUrl;
    return briefingUrl
      ? `StratSketch session required. Open ${briefingUrl} in a new tab, continue as guest if prompted, then try importing again.`
      : "StratSketch session required. Open the briefing on stratsketch.com in a new tab, continue as guest if prompted, then try importing again.";
  }
  if (event.code === 1006) {
    return "Browser could not reach StratSketch. Retrying via server import…";
  }
  return `StratSketch connection closed (${event.code}${event.reason ? ` ${event.reason}` : ""})`;
}

function fetchBriefingInBrowser(metadata, mapById, { timeoutMs = 20000 } = {}) {
  const url = `wss://${metadata.host}.stratsketch.com/?code=${encodeURIComponent(metadata.code)}&version=${LIVE_VERSION}`;
  const briefingUrl = `${STRATSKETCH_ORIGIN}/${metadata.code}`;

  return new Promise((resolve, reject) => {
    const slides = [];
    let briefingName = metadata.name;
    let persistedUsers = [];
    let finished = false;
    const ws = new WebSocket(url, ["bws"]);

    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (error) reject(error);
      else resolve(result);
    };

    const buildBriefing = () => ({
      name: briefingName,
      slides: mergeSlides(slides),
      persistedUsers,
    });

    const timer = setTimeout(() => {
      if (slides.length > 0) {
        finish(null, buildBriefing());
      } else {
        finish(new Error("Timed out waiting for StratSketch briefing data"));
      }
    }, timeoutMs);

    ws.binaryType = "arraybuffer";

    ws.addEventListener("message", (event) => {
      try {
        const buffer = new Uint8Array(event.data);
        if (buffer[0] !== 1) return;

        const messages = decodeDataMessages(buffer.subarray(1), mapById);
        for (const message of messages) {
          if (message.type === "init") {
            if (message.briefingName) briefingName = message.briefingName;
            persistedUsers = message.persistedUsers || [];
          }
          if (message.type === "slide") {
            slides.push(message.slide);
          }
          if (message.type === "entityAdd") {
            const slide = slides.find((entry) => entry.id === message.slideId);
            if (slide) slide.entities.push(...message.entities);
          }
        }

        if (
          slides.length > 0
          && messages.some((message) => message.type === "init" || message.type === "slide")
        ) {
          finish(null, buildBriefing());
        }
      } catch (error) {
        finish(error);
      }
    });

    ws.addEventListener("close", (event) => {
      if (finished) return;
      if (slides.length > 0) {
        finish(null, buildBriefing());
        return;
      }
      const failure = new Error(formatBrowserWsFailure({
        code: event.code,
        reason: event.reason,
        briefingUrl,
      }));
      failure.code = event.code;
      finish(failure);
    });
  });
}

async function importViaDevSidecar(urlOrCode) {
  const response = await fetch("http://127.0.0.1:8790/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: urlOrCode }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Local dev import helper failed");
  }
  return data;
}

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

async function importViaBrowser(urlOrCode) {
  const { metadata, maps } = await fetchStratSketchImportMetadata(urlOrCode);
  const mapById = new Map((maps || []).map((map) => [map.id, map.name]));
  const briefing = await fetchBriefingInBrowser(metadata, mapById);
  return {
    metadata: enrichMetadata(metadata, briefing),
    briefing,
    maps,
  };
}

async function buildPngConvertedStrat({
  briefing,
  converted,
  mapCatalog,
  defaultMapId,
  onStatus,
}) {
  onStatus?.("Rendering slide PNGs…");
  if (briefing?.slides?.length) {
    return convertStratSketchBriefingToPngSlides(briefing, {
      defaultMapId,
      mapCatalog,
      onProgress: onStatus,
    });
  }
  if (converted?.slides?.length) {
    return convertConvertedSlidesToPngSlides(converted, {
      mapCatalog,
      onProgress: onStatus,
    });
  }
  throw new Error("No StratSketch slides were returned");
}

export async function importStratSketchBriefing(
  urlOrCode,
  { defaultMapId, title, mapCatalog = [], onStatus } = {}
) {
  const code = parseStratSketchCode(urlOrCode);
  if (!code) {
    throw new Error("Invalid StratSketch URL or briefing code");
  }

  if (isLocalDevHost()) {
    try {
      onStatus?.("Loading briefing via local dev helper…");
      const sidecarResult = await importViaDevSidecar(urlOrCode);
      const source = sidecarResult.briefing || sidecarResult.converted;
      const metadata = enrichMetadata(sidecarResult.metadata || {}, source);
      try {
        const converted = await buildPngConvertedStrat({
          briefing: sidecarResult.briefing,
          converted: sidecarResult.converted,
          mapCatalog,
          defaultMapId,
          onStatus,
        });
        if (title) converted.title = String(title).trim() || converted.title;
        return {
          mode: "dev-sidecar",
          metadata,
          converted,
          briefingUrl: briefingUrlForInput(urlOrCode),
        };
      } catch (renderError) {
        throw new Error(`Could not render slide images: ${renderError.message}`);
      }
    } catch (sidecarError) {
      if (sidecarError.message?.startsWith("Could not render slide images:")) {
        throw sidecarError;
      }
      onStatus?.(`Local helper unavailable (${sidecarError.message}). Trying browser…`);
    }
  }

  try {
    const result = await importViaBrowser(urlOrCode);
    const converted = await buildPngConvertedStrat({
      briefing: result.briefing,
      mapCatalog,
      defaultMapId,
      onStatus,
    });
    if (title) converted.title = String(title).trim() || converted.title;
    return {
      mode: "browser",
      metadata: result.metadata,
      converted,
      briefingUrl: briefingUrlForInput(urlOrCode),
    };
  } catch (browserError) {
    if (browserError.code === 4001) {
      throw browserError;
    }

    if (isLocalDevHost()) {
      throw new Error(
        `${browserError.message} Ensure \`npm run dev\` is running so the StratSketch sidecar on port 8790 can load the briefing.`
      );
    }

    throw browserError;
  }
}

export { fetchStratSketchImportMetadata };
