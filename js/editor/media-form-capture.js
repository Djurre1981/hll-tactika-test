import { isMedalUrl, normalizeVideoUrl, youtubeThumbnail } from "../utils/video.js";
import {
  canExtractVideoFrame,
  fileFromImageSource,
  fileFromVideoFrame,
} from "../utils/video-frame.js";
import { resolveMedalClip } from "../utils/medal.js";
import {
  isDirectImageUrl,
  isPlatformThumbnailUrl,
  isPreviewStillUrl,
  mediaUrlMatchesThumbnail,
  pinHasCompactSilentThumbnail,
  findMediaItemForThumbnail,
} from "../helpers/pin-media.js";
import { uploadPreviewImage } from "../api/media.js";
import { syncThumbnailUi } from "./media-form.js";

let captureSelectedThumbnailUrl = null;
let captureSelectedThumbnailOwnerUrl = null;

function captureSetThumbnailUrl(url, ownerUrl) {
  captureSelectedThumbnailUrl = url;
  captureSelectedThumbnailOwnerUrl = ownerUrl;
}

function captureGetThumbnailUrl() {
  return captureSelectedThumbnailUrl;
}

function captureGetThumbnailOwnerUrl() {
  return captureSelectedThumbnailOwnerUrl;
}

function thumbnailMatchesMediaItem(thumbnailUrl, items) {
  return (items || []).some((item) =>
    mediaUrlMatchesThumbnail(String(item?.url || "").trim(), thumbnailUrl)
  );
}

async function captureStillFromVideo(videoItem) {
  if (!videoItem?.url) return null;
  const ytThumb = youtubeThumbnail(videoItem.url);
  if (ytThumb) return ytThumb;
  if (isMedalUrl(videoItem.url)) {
    try {
      const medal = await resolveMedalClip(videoItem.url);
      const medalThumb = String(medal?.thumbnailUrl || "").trim();
      if (medalThumb) return medalThumb;
    } catch (error) {
      console.warn("Could not resolve Medal thumbnail for save", error);
    }
  }
  if (canExtractVideoFrame(videoItem.url)) {
    try {
      const thumbFile = await fileFromVideoFrame(videoItem.url, "preview.jpg");
      const uploaded = await uploadPreviewImage(thumbFile);
      return uploaded.url;
    } catch (error) {
      console.warn("Could not capture video thumbnail for save", error);
    }
  }
  return null;
}

async function captureStillFromImage(imageItem) {
  if (!imageItem?.url || !isDirectImageUrl(imageItem.url)) return null;
  try {
    const thumbFile = await fileFromImageSource(imageItem.url, "preview.jpg");
    const uploaded = await uploadPreviewImage(thumbFile);
    return uploaded.url;
  } catch (error) {
    console.warn("Could not create image thumbnail for save", error);
    return null;
  }
}

async function ensureCapturedThumbnailForSave(items, thumbnailUrl = "") {
  const current = String(thumbnailUrl || "").trim();
  const list = items || [];
  if (
    pinHasCompactSilentThumbnail({ thumbnail: current, mediaItems: list }) ||
    isPlatformThumbnailUrl(current)
  ) {
    return current;
  }
  const ownerFromSelection =
    captureSelectedThumbnailOwnerUrl &&
    list.find(
      (item) =>
        normalizeVideoUrl(item.url) === normalizeVideoUrl(captureSelectedThumbnailOwnerUrl)
    );
  const starred =
    ownerFromSelection || (current ? findMediaItemForThumbnail(list, current) : null);
  const firstVideo = list.find((item) => item?.kind === "video" && item.url) || null;
  const firstImage =
    list.find((item) => item?.kind === "image" && isDirectImageUrl(item.url)) || null;
  const candidates = [];
  if (starred?.kind === "video") candidates.push(starred);
  else if (starred?.kind === "image") candidates.push(starred);
  else {
    if (firstVideo) candidates.push(firstVideo);
    if (firstImage) candidates.push(firstImage);
  }
  if (starred) {
    if (firstVideo && firstVideo !== starred) candidates.push(firstVideo);
    if (firstImage && firstImage !== starred) candidates.push(firstImage);
  }
  for (const item of candidates) {
    const still =
      item.kind === "video"
        ? await captureStillFromVideo(item)
        : await captureStillFromImage(item);
    if (!still) continue;
    captureSelectedThumbnailOwnerUrl = item.url;
    captureSelectedThumbnailUrl = still;
    syncThumbnailUi();
    return still;
  }
  if (isPreviewStillUrl(current) && !thumbnailMatchesMediaItem(current, list)) {
    return current;
  }
  return current;
}

export {
  captureStillFromVideo,
  captureStillFromImage,
  ensureCapturedThumbnailForSave,
  captureSetThumbnailUrl,
  captureGetThumbnailUrl,
  captureGetThumbnailOwnerUrl,
};
