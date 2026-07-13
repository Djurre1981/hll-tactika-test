import WS from "ws";

export function isNodeWsAvailable() {
  return typeof WS === "function";
}

export function openStratSketchWebSocket(url, headers) {
  return new WS(url, ["bws"], { headers });
}
