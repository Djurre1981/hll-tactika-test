export const SLIDE_RENDER_SIZE = 2048;
const MAX_SLIDE_UPLOAD_BYTES = 7.5 * 1024 * 1024;
const SLIDE_IMAGE_TYPE = "image/webp";
const SLIDE_IMAGE_EXTENSION = "webp";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${src}`));
    image.src = src;
  });
}

async function rasterizeSvgElement(svg, { width, height }) {
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const serialized = new XMLSerializer().serializeToString(clone);
  const objectUrl = URL.createObjectURL(
    new Blob([serialized], { type: "image/svg+xml;charset=utf-8" })
  );

  try {
    return await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToImageBlob(canvas, { type = SLIDE_IMAGE_TYPE, quality = 0.88 } = {}) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode slide image"));
    }, type, quality);
  });
}

async function encodeSlideCanvas(canvas) {
  let quality = 0.88;
  let blob = await canvasToImageBlob(canvas, { quality });

  while (blob.size > MAX_SLIDE_UPLOAD_BYTES && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToImageBlob(canvas, { quality });
  }

  if (blob.size > MAX_SLIDE_UPLOAD_BYTES) {
    const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Rendered slide image is too large (${sizeMb} MB, max 8 MB).`);
  }

  return blob;
}

export async function compositeSlideToImageBlob(
  mapImageSrc,
  overlaySvg,
  { width = SLIDE_RENDER_SIZE, height = SLIDE_RENDER_SIZE } = {}
) {
  const mapImage = await loadImage(mapImageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas rendering is unavailable");
  }

  context.drawImage(mapImage, 0, 0, width, height);

  if (overlaySvg) {
    const overlayImage = await rasterizeSvgElement(overlaySvg, { width, height });
    context.drawImage(overlayImage, 0, 0, width, height);
  }

  return encodeSlideCanvas(canvas);
}

export async function compositeSlideToPngBlob(mapImageSrc, overlaySvg, options = {}) {
  return compositeSlideToImageBlob(mapImageSrc, overlaySvg, options);
}

export function getSlideImageUploadMeta() {
  return {
    extension: SLIDE_IMAGE_EXTENSION,
    mimeType: SLIDE_IMAGE_TYPE,
  };
}

export async function svgElementToPngBlob(svg, { width = SLIDE_RENDER_SIZE, height = SLIDE_RENDER_SIZE } = {}) {
  const image = await rasterizeSvgElement(svg, { width, height });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas rendering is unavailable");
  }
  context.drawImage(image, 0, 0, width, height);
  return encodeSlideCanvas(canvas);
}

export async function webpUrlToPngBlob(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch StratSketch slide image (${response.status})`);
  }
  const webpBlob = await response.blob();
  const objectUrl = URL.createObjectURL(webpBlob);

  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || SLIDE_RENDER_SIZE;
    canvas.height = image.naturalHeight || SLIDE_RENDER_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas rendering is unavailable");
    }
    context.drawImage(image, 0, 0);
    return encodeSlideCanvas(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
