import { uploadPreviewImage } from "../api/media.js";
import { assetUrl } from "../helpers/asset-url.js";
import { convertStratSketchBriefing } from "./stratsketch-convert.js";
import { renderStratSlideOverlaySvg } from "./strat-draw-render.js";
import { compositeSlideToImageBlob, getSlideImageUploadMeta } from "./stratsketch-slide-png.js";

function resolveMapImageSrc(mapId, mapCatalog) {
  const imagePath = mapCatalog.find((map) => map.id === mapId)?.image;
  if (!imagePath) return "";
  const path = assetUrl(imagePath);
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, window.location.origin).href;
}

async function uploadSlideImage(imageBlob, slideName, index) {
  const { extension, mimeType } = getSlideImageUploadMeta();
  const safeName = String(slideName || `slide-${index + 1}`)
    .replace(/[^\w.-]+/g, "-")
    .slice(0, 48) || `slide-${index + 1}`;
  const file = new File([imageBlob], `${safeName}.${extension}`, { type: mimeType });
  const uploaded = await uploadPreviewImage(file);
  return uploaded.url;
}

async function rasterizeSlides(slides, { mapCatalog = [], onProgress } = {}) {
  const rasterized = [];

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    onProgress?.(`Rendering slide ${index + 1} of ${slides.length}: ${slide.name}`);

    const mapImageSrc = resolveMapImageSrc(slide.mapId, mapCatalog);
    const overlaySvg = renderStratSlideOverlaySvg(slide.objects);
    const imageBlob = await compositeSlideToImageBlob(mapImageSrc, overlaySvg);
    const rasterUrl = await uploadSlideImage(imageBlob, slide.name, index);

    rasterized.push({
      ...slide,
      objects: [],
      rasterUrl,
    });
  }

  return rasterized;
}

export async function convertConvertedSlidesToPngSlides(
  converted,
  { mapCatalog = [], onProgress } = {}
) {
  return {
    ...converted,
    slides: await rasterizeSlides(converted.slides || [], { mapCatalog, onProgress }),
  };
}

export async function convertStratSketchBriefingToPngSlides(
  briefing,
  {
    defaultMapId,
    mapCatalog = [],
    onProgress,
  } = {}
) {
  const converted = convertStratSketchBriefing(briefing, { defaultMapId });
  return {
    ...converted,
    slides: await rasterizeSlides(converted.slides, { mapCatalog, onProgress }),
  };
}
