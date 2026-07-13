import { assertSameOrigin } from "./lib/same-origin.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.pathname === "/data/pins.json") {
    return new Response("Not found", { status: 404 });
  }

  if (url.pathname.startsWith("/api/")) {
    const originError = assertSameOrigin(context.request);
    if (originError) {
      return originError;
    }
  }

  return context.next();
}
