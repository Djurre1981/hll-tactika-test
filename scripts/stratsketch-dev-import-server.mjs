#!/usr/bin/env node
/**
 * Local dev helper: StratSketch import over Node WebSocket (port 8790).
 * Wrangler Workers cannot send StratSketch session cookies on outbound WS.
 */
import http from "node:http";
import { fetchStratSketchExport, parseStratSketchCode } from "../functions/lib/stratsketch-client.js";

const PORT = 8790;
const HOST = "127.0.0.1";

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== "POST" || req.url !== "/import") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  let parsed;
  try {
    parsed = JSON.parse(body || "{}");
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const url = String(parsed.url || "").trim();
  if (!parseStratSketchCode(url)) {
    sendJson(res, 400, { error: "Invalid StratSketch URL or briefing code" });
    return;
  }

  try {
    const exported = await fetchStratSketchExport(url);
    sendJson(res, 200, {
      metadata: {
        code: exported.metadata.code,
        name: exported.metadata.name,
        revision: exported.metadata.revision,
        screenshotUrl: exported.metadata.screenshotUrl,
        creatorUsername: exported.metadata.creatorUsername,
        createdAt: exported.metadata.createdAt,
      },
      briefing: exported.briefing,
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message || "StratSketch import failed" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`StratSketch dev import sidecar on http://${HOST}:${PORT}`);
});
