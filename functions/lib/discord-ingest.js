import {
  IMAGE_EXTENSIONS,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_EXTENSIONS,
  appImageUrl,
  appVideoUrl,
  discordImageR2Key,
  discordVideoR2Key,
  extensionFromFilename,
} from "./app-media.js";
import { extractDiscordAttachmentId, isDiscordMediaUrl } from "./discord-url.js";

const EXPIRED_DISCORD_MESSAGE =
  "Discord link expired — copy a fresh attachment URL from Discord or upload the file directly.";

function contentTypeForKind(kind, url) {
  let extension = "";
  try {
    extension = extensionFromFilename(new URL(url).pathname);
  } catch {
    extension = "";
  }
  if (kind === "image") {
    return IMAGE_EXTENSIONS[extension] || "image/jpeg";
  }
  return VIDEO_EXTENSIONS[extension] || "video/mp4";
}

function maxBytesForKind(kind) {
  return kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
}

function maxSizeLabel(kind) {
  const bytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  return `${bytes / (1024 * 1024)} MB`;
}

function r2KeyForKind(kind, attachmentId) {
  return kind === "image" ? discordImageR2Key(attachmentId) : discordVideoR2Key(attachmentId);
}

function appUrlForKind(kind, attachmentId) {
  return kind === "image" ? appImageUrl(attachmentId) : appVideoUrl(attachmentId);
}

function limitedStream(body, maxBytes, kind) {
  const reader = body.getReader();
  let total = 0;

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      total += value.byteLength;
      if (total > maxBytes) {
        controller.error(new Error(`Discord file too large (max ${maxSizeLabel(kind)})`));
        await reader.cancel();
        return;
      }

      controller.enqueue(value);
    },
    cancel() {
      return reader.cancel();
    },
  });
}

async function r2ObjectExists(env, key) {
  if (!env.VIDEOS_R2) {
    return false;
  }
  const head = await env.VIDEOS_R2.head(key);
  return Boolean(head);
}

export async function mirrorDiscordUrl(env, url, kind) {
  const normalized = String(url || "").trim();
  if (!isDiscordMediaUrl(normalized)) {
    return { url: normalized };
  }

  if (!env.VIDEOS_R2) {
    return { error: "Video storage is not configured", status: 503 };
  }

  const attachmentId = extractDiscordAttachmentId(normalized);
  if (!attachmentId) {
    return { error: "Invalid Discord attachment URL" };
  }

  const r2Key = r2KeyForKind(kind, attachmentId);
  const appUrl = appUrlForKind(kind, attachmentId);

  if (await r2ObjectExists(env, r2Key)) {
    return { url: appUrl };
  }

  let response;
  try {
    response = await fetch(normalized, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HLL-Tactika/1.0)",
        Accept: "*/*",
      },
      redirect: "error",
    });
  } catch {
    return { error: EXPIRED_DISCORD_MESSAGE };
  }

  if (!response.ok) {
    if (response.status === 403) {
      // Discord blocks Cloudflare Workers from fetching attachments; keep the
      // original URL so pins still play in the browser until the link expires.
      return { url: normalized };
    }
    if (response.status === 404) {
      return { error: EXPIRED_DISCORD_MESSAGE };
    }
    return { error: `Could not import Discord attachment (${response.status})` };
  }

  const maxBytes = maxBytesForKind(kind);
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { error: `Discord file too large (max ${maxSizeLabel(kind)})` };
  }

  const body = response.body ? limitedStream(response.body, maxBytes, kind) : null;
  if (!body) {
    return { error: EXPIRED_DISCORD_MESSAGE };
  }

  try {
    await env.VIDEOS_R2.put(r2Key, body, {
      httpMetadata: {
        contentType:
          response.headers.get("content-type")?.split(";")[0]?.trim() ||
          contentTypeForKind(kind, normalized),
      },
      customMetadata: {
        source: "discord",
        attachmentId,
      },
    });
  } catch (error) {
    if (String(error?.message || "").includes("too large")) {
      return { error: `Discord file too large (max ${maxSizeLabel(kind)})` };
    }
    console.error("Discord mirror failed:", error);
    return { error: EXPIRED_DISCORD_MESSAGE };
  }

  return { url: appUrl };
}

async function mirrorUrlWithCache(env, url, kind, cache) {
  const normalized = String(url || "").trim();
  if (!normalized || !isDiscordMediaUrl(normalized)) {
    return { url: normalized };
  }

  if (cache.has(normalized)) {
    return { url: cache.get(normalized) };
  }

  const result = await mirrorDiscordUrl(env, normalized, kind);
  if (result.error) {
    return result;
  }

  cache.set(normalized, result.url);
  return result;
}

function deriveLegacyFields(mediaItems) {
  const firstVideo = mediaItems.find((item) => item.kind === "video");
  const firstImage = mediaItems.find((item) => item.kind === "image");
  return {
    videoUrl: firstVideo?.url || "",
    thumbnail: firstImage?.url || undefined,
  };
}

function resolveMirroredThumbnail(requestedThumbnail, sourceItems, mirroredItems) {
  const thumb = String(requestedThumbnail || "").trim();
  if (!thumb) return null;

  for (let i = 0; i < sourceItems.length; i++) {
    const sourceUrl = String(sourceItems[i]?.url || "").trim();
    if (sourceUrl === thumb) {
      return mirroredItems[i]?.url || null;
    }
  }

  const mirroredMatch = mirroredItems.find((item) => item.url === thumb);
  return mirroredMatch?.url || thumb;
}

export async function mirrorPinMedia(env, pin) {
  const next = { ...pin };
  const cache = new Map();
  const requestedThumbnail = String(next.thumbnail || "").trim();

  if (Array.isArray(next.mediaItems) && next.mediaItems.length > 0) {
    const sourceItems = next.mediaItems;
    const mediaItems = [];
    for (const item of sourceItems) {
      const kind = item?.kind === "image" ? "image" : "video";
      const mirrored = await mirrorUrlWithCache(env, item?.url, kind, cache);
      if (mirrored.error) {
        return mirrored;
      }
      mediaItems.push({ kind, url: mirrored.url });
    }
    next.mediaItems = mediaItems;
    const legacy = deriveLegacyFields(mediaItems);
    next.videoUrl = legacy.videoUrl;

    const resolved = resolveMirroredThumbnail(requestedThumbnail, sourceItems, mediaItems);
    if (resolved) {
      next.thumbnail = resolved;
    } else if (legacy.thumbnail) {
      next.thumbnail = legacy.thumbnail;
    } else {
      delete next.thumbnail;
    }
    return { pin: next };
  }

  if (next.videoUrl) {
    const mirrored = await mirrorUrlWithCache(env, next.videoUrl, "video", cache);
    if (mirrored.error) {
      return mirrored;
    }
    next.videoUrl = mirrored.url;
  }

  if (next.thumbnail) {
    const mirrored = await mirrorUrlWithCache(env, next.thumbnail, "image", cache);
    if (mirrored.error) {
      return mirrored;
    }
    next.thumbnail = mirrored.url;
  }

  return { pin: next };
}
