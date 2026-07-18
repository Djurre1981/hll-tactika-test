export function isDirectVideo(url) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

export function isAppVideoPath(url) {
  if (!url) return false;
  try {
    const path = url.startsWith("/") ? url.split("?")[0] : new URL(url, window.location.origin).pathname;
    return /^\/api\/videos\/(\d{17,20}|[0-9a-f-]{36})$/i.test(path);
  } catch {
    return false;
  }
}

export function isDiscordMediaUrl(url) {
  const hostname = getHostname(url);
  if (hostname !== "cdn.discordapp.com" && hostname !== "media.discordapp.net") {
    return false;
  }

  const parsed = parseMediaUrl(url);
  return parsed?.pathname.includes("/attachments/") ?? false;
}

export function isPlayableDirectUrl(url) {
  return isDirectVideo(url) || isDiscordMediaUrl(url) || isAppVideoPath(url);
}

export function normalizeVideoUrl(url) {
  return String(url || "").trim();
}

function parseMediaUrl(url) {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    try {
      const base = typeof window !== "undefined" ? window.location.href : "https://localhost/";
      return new URL(url, base);
    } catch {
      return null;
    }
  }
}

function getHostname(url) {
  const parsed = parseMediaUrl(url);
  return parsed?.hostname.replace(/^www\./, "") || "";
}

export function isMedalUrl(url) {
  return getHostname(url) === "medal.tv";
}

export function isYoutubeUrl(url) {
  const hostname = getHostname(url);
  return hostname.includes("youtube.com") || hostname === "youtu.be";
}

export function isVimeoUrl(url) {
  return getHostname(url).includes("vimeo.com");
}

export function isSupportedVideoUrl(url) {
  const normalized = normalizeVideoUrl(url);
  if (!normalized) {
    return false;
  }

  return (
    isYoutubeUrl(normalized) ||
    isMedalUrl(normalized) ||
    isDiscordMediaUrl(normalized) ||
    isPlayableDirectUrl(normalized) ||
    isVimeoUrl(normalized) ||
    isAppVideoPath(normalized)
  );
}

export function getUnsupportedVideoUrlMessage() {
  return "Use a YouTube, Medal.tv, Discord attachment, Vimeo, uploaded video, or direct .mp4 link.";
}

export function toEmbedUrl(url, { autoplay = false, mute = false } = {}) {
  if (!url) return url;

  if (isPlayableDirectUrl(url)) return url;

  try {
    const parsed = parseMediaUrl(url);
    if (!parsed) return url;

    if (parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be")) {
      let videoId = parsed.searchParams.get("v");
      if (!videoId && parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.replace("/", "");
      }
      if (!videoId && parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/embed/")[1]?.split("/")[0];
      }
      if (videoId) {
        const params = new URLSearchParams({
          rel: "0",
          modestbranding: "1",
        });
        if (autoplay) params.set("autoplay", "1");
        if (mute || autoplay) params.set("mute", "1");
        return `https://www.youtube.com/embed/${videoId}?${params}`;
      }
    }

    if (parsed.hostname.includes("vimeo.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const id = parts[parts.length - 1];
      if (id) {
        const params = new URLSearchParams();
        if (autoplay) params.set("autoplay", "1");
        if (mute || autoplay) params.set("muted", "1");
        const query = params.toString();
        return `https://player.vimeo.com/video/${id}${query ? `?${query}` : ""}`;
      }
    }

    // Medal.tv blocks external iframes; callers must resolve to MP4 first.
  } catch {
    return url;
  }

  return url;
}

export function teardownMediaElement(el) {
  if (!el) return;

  if (el instanceof HTMLVideoElement) {
    try {
      el.pause();
    } catch {
      /* ignore */
    }
    el.removeAttribute("src");
    el.src = "";
    el.load();
    return;
  }

  if (el instanceof HTMLIFrameElement) {
    el.src = "about:blank";
  }
}

export function clearMediaContainer(container) {
  if (!container) return;
  container.querySelectorAll("video, iframe").forEach((el) => teardownMediaElement(el));
  container.innerHTML = "";
}

export function createVideoElement(
  url,
  { autoplay = false, muted = false, controls = true, preload = "metadata" } = {}
) {
  if (isPlayableDirectUrl(url)) {
    const video = document.createElement("video");
    video.src = url;
    video.controls = controls;
    video.playsInline = true;
    video.preload = preload;
    if (autoplay) video.autoplay = true;
    if (muted) video.muted = true;
    if (autoplay) {
      video.play().catch(() => {
        /* autoplay blocked — expect user gesture */
      });
    }
    return video;
  }

  const iframe = document.createElement("iframe");
  iframe.src = toEmbedUrl(url, { autoplay, mute: muted });
  iframe.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
  iframe.allowFullscreen = true;
  iframe.title = "Trick video";
  return iframe;
}

/** Extract a YouTube video id from watch/embed/short/live URLs or CDN stills. */
export function youtubeVideoId(url) {
  try {
    const parsed = parseMediaUrl(url);
    if (!parsed) return null;
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "img.youtube.com" || host === "i.ytimg.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const viIdx = parts.findIndex((part) => part === "vi" || part === "vi_webp");
      if (viIdx >= 0 && parts[viIdx + 1]) return parts[viIdx + 1];
      return null;
    }

    if (host === "youtu.be") {
      return parsed.pathname.replace(/^\//, "").split("/")[0] || null;
    }

    if (host.includes("youtube.com")) {
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery) return fromQuery;
      for (const prefix of ["/embed/", "/shorts/", "/live/"]) {
        if (parsed.pathname.startsWith(prefix)) {
          return parsed.pathname.slice(prefix.length).split("/")[0] || null;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function youtubeThumbnail(url) {
  const videoId = youtubeVideoId(url);
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}
