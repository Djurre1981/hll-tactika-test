import { uploadPreviewImage, uploadVideo } from "../api/media.js";
import { deriveLegacyMediaFields } from "./pin-media.js";
import { isDiscordMediaUrl } from "../utils/video.js";

function filenameFromUrl(url, kind) {
  try {
    const base = new URL(url).pathname.split("/").pop();
    if (base) return base;
  } catch {
    // ignore
  }
  return kind === "image" ? "discord-image.jpg" : "discord-video.mp4";
}

async function ingestDiscordUrl(url, kind) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch Discord attachment (${response.status})`);
  }

  const blob = await response.blob();
  const file = new File([blob], filenameFromUrl(url, kind), {
    type: blob.type || (kind === "image" ? "image/jpeg" : "video/mp4"),
  });

  if (kind === "image") {
    return (await uploadPreviewImage(file)).url;
  }
  return (await uploadVideo(file)).url;
}

export async function ingestDiscordPinMedia(pinData) {
  const sourceItems = Array.isArray(pinData.mediaItems) ? pinData.mediaItems : [];
  if (!sourceItems.some((item) => isDiscordMediaUrl(item?.url))) {
    return pinData;
  }

  const mediaItems = [];
  for (const item of sourceItems) {
    const kind = item?.kind === "image" ? "image" : "video";
    const url = String(item?.url || "").trim();
    if (!url) continue;

    if (isDiscordMediaUrl(url)) {
      mediaItems.push({ kind, url: await ingestDiscordUrl(url, kind) });
    } else {
      mediaItems.push({ kind, url });
    }
  }

  const legacy = deriveLegacyMediaFields(mediaItems, pinData.thumbnail);
  return {
    ...pinData,
    videoUrl: legacy.videoUrl,
    thumbnail: legacy.thumbnail || "",
    mediaItems: legacy.mediaItems,
  };
}
