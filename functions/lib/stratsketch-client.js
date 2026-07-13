import {
  decodeDataMessages,
} from "./stratsketch-binary.js";
import { parseStratSketchPageMetadata } from "./stratsketch-metadata.js";

const LIVE_VERSION = "2";
const STRATSKETCH_ORIGIN = "https://stratsketch.com";

let nodeWsModulePromise;

async function loadNodeWsModule() {
  if (!nodeWsModulePromise) {
    nodeWsModulePromise = import("./stratsketch-ws-node.js").catch(() => null);
  }
  return nodeWsModulePromise;
}

async function openStratSketchWebSocket(url, cookie) {
  const headers = {
    Cookie: cookie,
    Origin: STRATSKETCH_ORIGIN,
    Referer: STRATSKETCH_ORIGIN,
    "User-Agent": "HLL-Tactika-StratImport/0.1",
  };

  const nodeWs = await loadNodeWsModule();
  if (nodeWs?.isNodeWsAvailable?.()) {
    return nodeWs.openStratSketchWebSocket(url, headers);
  }

  throw new Error(
    "StratSketch WebSocket is not available in this runtime. Use the browser import path or the local dev sidecar."
  );
}

function bindWebSocketEvents(ws, handlers) {
  if (typeof ws.on === "function") {
    ws.on("message", handlers.onMessage);
    ws.on("close", handlers.onClose);
    ws.on("error", handlers.onError);
    return;
  }

  ws.binaryType = "arraybuffer";
  ws.addEventListener("message", handlers.onMessage);
  ws.addEventListener("close", handlers.onClose);
  ws.addEventListener("error", handlers.onError);
}

function closeWebSocket(ws) {
  try {
    if (typeof ws.terminate === "function") {
      ws.terminate();
      return;
    }
    ws.close();
  } catch {
    /* ignore */
  }
}

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

export async function fetchStratSketchMetadata(code) {
  const response = await fetch(`${STRATSKETCH_ORIGIN}/${code}`, {
    headers: { "user-agent": "HLL-Tactika-StratImport/0.1" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`StratSketch briefing not found (${response.status})`);
  }

  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("Could not parse StratSketch page metadata");
  }

  const nextData = JSON.parse(match[1]);
  const pageMeta = parseStratSketchPageMetadata(nextData, html);
  const briefing = nextData?.props?.pageProps?.briefing;
  if (!briefing?.code || !briefing?.host) {
    throw new Error("StratSketch briefing metadata is incomplete");
  }

  const setCookies = response.headers.getSetCookie?.() || [];
  const sidPair = setCookies
    .map((line) => line.split(";")[0])
    .find((pair) => pair.startsWith("sid="));
  if (!sidPair) {
    throw new Error("Could not obtain StratSketch session cookie");
  }

  const cookie = sidPair;

  // Visiting the briefing page creates a guest session; warm it before WS connect.
  await fetch(`${STRATSKETCH_ORIGIN}/api/session`, {
    headers: { cookie },
  });

  return {
    code: briefing.code,
    name: pageMeta.name || briefing.name || "Imported Strat",
    host: briefing.host,
    revision: briefing.revision,
    game: briefing.game,
    screenshotUrl: pageMeta.screenshotUrl,
    createdAt: pageMeta.createdAt,
    creatorUsername: pageMeta.creatorUsername,
    cookie,
  };
}

export async function fetchHllMapLookup() {
  const response = await fetch(`${STRATSKETCH_ORIGIN}/api/packs/game/hll?v=7`, {
    headers: { cookie: "" },
  });
  if (!response.ok) {
    throw new Error("Could not load StratSketch HLL map pack");
  }
  const data = await response.json();
  return new Map((data.maps || []).map((map) => [map.id, map.name]));
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

export function fetchStratSketchBriefing(metadata, { timeoutMs = 20000 } = {}) {
  const url = `wss://${metadata.host}.stratsketch.com/?code=${encodeURIComponent(metadata.code)}&version=${LIVE_VERSION}`;

  return new Promise((resolve, reject) => {
    const slides = [];
    let persistedUsers = [];
    let briefingName = metadata.name;
    let mapByIdPromise = fetchHllMapLookup();
    let finished = false;
    let ws;

    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (ws) closeWebSocket(ws);
      if (error) reject(error);
      else resolve(result);
    };

    const buildResult = () => ({
      name: briefingName,
      slides: mergeSlides(slides),
      persistedUsers,
    });

    const timer = setTimeout(() => {
      if (slides.length > 0) {
        finish(null, buildResult());
      } else {
        finish(new Error("Timed out waiting for StratSketch briefing data"));
      }
    }, timeoutMs);

    const onMessage = async (event) => {
      try {
        const raw = event.data ?? event;
        const buffer = new Uint8Array(raw);
        const frameType = buffer[0];
        if (frameType !== 1) return;

        const mapById = await mapByIdPromise;
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
            if (slide) {
              slide.entities.push(...message.entities);
            }
          }
        }

        if (slides.length > 0 && messages.some((message) => message.type === "init" || message.type === "slide")) {
          finish(null, buildResult());
        }
      } catch (error) {
        finish(error);
      }
    };

    const onClose = (event, reasonBuffer) => {
      if (finished) return;
      if (slides.length > 0) {
        finish(null, buildResult());
        return;
      }
      const code = typeof event === "object" ? event.code : event;
      const reason = typeof event === "object"
        ? (event.reason?.toString?.() ?? event.reason ?? "")
        : (reasonBuffer?.toString?.() ?? "");
      finish(new Error(`StratSketch connection closed (${code}${reason ? ` ${reason}` : ""})`));
    };

    const onError = () => {
      // close event carries the actionable failure reason
    };

    openStratSketchWebSocket(url, metadata.cookie)
      .then((socket) => {
        ws = socket;
        bindWebSocketEvents(ws, { onMessage, onClose, onError });
      })
      .catch((error) => finish(error));
  });
}

export async function fetchStratSketchExport(urlOrCode) {
  const code = parseStratSketchCode(urlOrCode);
  if (!code) {
    throw new Error("Invalid StratSketch URL or briefing code");
  }
  const metadata = await fetchStratSketchMetadata(code);
  const briefing = await fetchStratSketchBriefing(metadata);
  const { resolveStratSketchCreator } = await import("./stratsketch-metadata.js");
  const creatorUsername = metadata.creatorUsername || resolveStratSketchCreator(briefing.persistedUsers);
  return {
    metadata: {
      ...metadata,
      creatorUsername,
    },
    briefing,
  };
}
