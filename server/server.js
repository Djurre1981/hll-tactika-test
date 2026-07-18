import http from "node:http";
import { WebSocketServer } from "ws";
import { verifyCollabToken } from "./lib/crypto.js";
import { attachClient, flushAllRooms, getOrCreateRoom } from "./lib/rooms.js";

const PORT = Number(process.env.PORT) || 4080;
const JWT_SECRET = String(process.env.COLLAB_JWT_SECRET || "").trim();

if (!JWT_SECRET) {
  console.warn("[collab] COLLAB_JWT_SECRET is not set — all upgrades will be rejected");
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/health" || req.url?.startsWith("/health?"))) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("not found");
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname !== "/collab") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const roomId = url.searchParams.get("room") || "";
    const token = url.searchParams.get("token") || "";
    const result = verifyCollabToken(token, JWT_SECRET);

    if (result.status !== "ok") {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    if (result.payload.roomId !== roomId) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, result.payload, roomId);
    });
  } catch (err) {
    console.error("[collab] upgrade error:", err);
    socket.destroy();
  }
});

wss.on("connection", async (ws, _req, payload, roomId) => {
  try {
    const room = await getOrCreateRoom(roomId);
    attachClient(room, ws, {
      steamId: payload.steamId,
      role: payload.role,
      displayName: payload.displayName || "",
    });
    console.log(`[collab] join ${roomId} steam=${payload.steamId}`);
  } catch (err) {
    console.error("[collab] connection setup failed:", err);
    ws.close();
  }
});

async function shutdown(signal) {
  console.log(`[collab] ${signal} — flushing rooms`);
  try {
    await flushAllRooms();
  } catch (err) {
    console.error("[collab] flush on shutdown failed:", err);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, () => {
  console.log(`[collab] listening on :${PORT} (GET /health, WS /collab)`);
  // Phase 9: Discord bot can start here in the same process (gateway outbound only).
});
