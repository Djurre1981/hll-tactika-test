import { resolvePinDetail, cachePinDetail, getCachedPinDetail } from "../helpers/pin-detail-cache.js";
import { state } from "../state.js";
import {
  isMedalUrl,
  normalizeVideoUrl,
  youtubeThumbnail,
} from "../utils/video.js";
import { resolveMedalClip } from "../utils/medal.js";
import {
  canExtractVideoFrame,
  fileFromImageSource,
  fileFromVideoFrame,
} from "../utils/video-frame.js";
import { fillPinThumbnail, fillPinThumbnailUrl } from "../api/pins.js";
import {
  findMediaItemForThumbnail,
  getPinMediaItems,
  isDirectImageUrl,
  isPlatformThumbnailUrl,
  isPreviewStillUrl,
  pinNeedsCompactStill,
} from "../helpers/pin-media.js";
import {
  absoluteThumbUrl,
  ensureWarmedThumbnail,
} from "../helpers/thumbnail-cache.js";

const thumbnailPersistInflight = new Set();

function beginPreviewLoad() {
  state.previewLoadAbort?.abort();
  state.previewLoadAbort = new AbortController();
  return state.previewLoadAbort.signal;
}

function cancelPreviewTimers() {
  clearTimeout(state.previewDetailTimer);
  state.previewDetailTimer = null;
  clearTimeout(state.previewVideoTimer);
  state.previewVideoTimer = null;
  clearTimeout(state.previewIframeRevealTimer);
  state.previewIframeRevealTimer = null;
}

async function getMediaPlayback(mediaItem, { signal } = {}) {
  if (!mediaItem) {
    return { playbackUrl: null, thumbnail: null, isImage: false };
  }

  if (mediaItem.kind === "image") {
    return { playbackUrl: mediaItem.url, thumbnail: mediaItem.url, isImage: true };
  }

  let playbackUrl = normalizeVideoUrl(mediaItem.url);
  let thumbnail = youtubeThumbnail(playbackUrl);

  if (isMedalUrl(mediaItem.url)) {
    const medal = await resolveMedalClip(mediaItem.url, { signal });
    playbackUrl = medal.contentUrl;
    thumbnail = thumbnail || medal.thumbnailUrl;
  }

  return { playbackUrl, thumbnail, isImage: false, sourceUrl: mediaItem.url };
}

async function getPinPreviewPlayback(pin, signal) {
  return getMediaPlayback(getPinThumbnailMediaItem(pin), { signal });
}

function getPinThumbnailMediaItem(pin) {
  const items = getPinMediaItems(pin);
  if (!items.length) return null;

  const thumb = String(pin.thumbnail || "").trim();
  if (thumb) {
    const owner = findMediaItemForThumbnail(items, thumb);
    if (owner) return owner;
  }

  return items[0];
}

async function getPinPlayback(pin, mediaIndex = 0) {
  const items = getPinMediaItems(pin);
  return getMediaPlayback(items[mediaIndex]);
}

function patchLocalPinThumbnail(mapId, pinId, thumbnail) {
  const thumb = String(thumbnail || "").trim();
  if (!mapId || !pinId || !thumb) return;

  const catalog = state.pinCatalog[mapId];
  if (Array.isArray(catalog)) {
    const marker = catalog.find((item) => item.id === pinId);
    if (marker) marker.thumbnail = thumb;
  }

  const live = state.pins.find((item) => item.id === pinId);
  if (live) live.thumbnail = thumb;

  const cached = getCachedPinDetail(mapId, pinId);
  if (cached) {
    cachePinDetail(mapId, pinId, { ...cached, thumbnail: thumb });
  }

  void ensureWarmedThumbnail(mapId, thumb);
}

async function maybePersistHoverThumbnail(pin, stillUrl, playback) {
  if (!pin?.id || !pinNeedsCompactStill(pin)) return;
  const mapId = state.currentMapId;
  if (!mapId) return;

  const key = `${mapId}:${pin.id}`;
  if (thumbnailPersistInflight.has(key)) return;
  thumbnailPersistInflight.add(key);

  try {
    const platformStill =
      (stillUrl && isPlatformThumbnailUrl(stillUrl) && String(stillUrl).trim()) ||
      (playback?.thumbnail &&
        isPlatformThumbnailUrl(playback.thumbnail) &&
        String(playback.thumbnail).trim()) ||
      "";

    let result = null;
    if (platformStill) {
      patchLocalPinThumbnail(mapId, pin.id, platformStill);
      result = await fillPinThumbnailUrl(mapId, pin.id, platformStill);
    } else if (playback?.playbackUrl && canExtractVideoFrame(playback.playbackUrl)) {
      const file = await fileFromVideoFrame(playback.playbackUrl, "preview.jpg");
      result = await fillPinThumbnail(mapId, pin.id, file);
    } else {
      const imageItem = getPinMediaItems(pin).find(
        (item) => item.kind === "image" && isDirectImageUrl(item.url)
      );
      if (!imageItem) return;
      const file = await fileFromImageSource(imageItem.url, "preview.jpg");
      result = await fillPinThumbnail(mapId, pin.id, file);
    }

    const saved = String(result?.thumbnail || "").trim();
    if (saved) {
      patchLocalPinThumbnail(mapId, pin.id, saved);
    }
  } catch (error) {
    console.warn("Hover thumbnail persist skipped", error);
  } finally {
    thumbnailPersistInflight.delete(key);
  }
}

export {
  beginPreviewLoad,
  cancelPreviewTimers,
  getMediaPlayback,
  getPinPreviewPlayback,
  getPinThumbnailMediaItem,
  getPinPlayback,
  patchLocalPinThumbnail,
  maybePersistHoverThumbnail,
};
