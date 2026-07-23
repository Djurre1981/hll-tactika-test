/** Strongpoint name labels — maps-let-loose / climbing-guide parity. */

export const STRONGPOINT_MAP_SIZE = 1920;

let namesCache = null;
let namesPromise = null;

export function loadStrongpointNames() {
  if (namesCache) return Promise.resolve(namesCache);
  if (namesPromise) return namesPromise;
  namesPromise = fetch("/data/strongpoint-names.json")
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({}))
    .then((data) => {
      namesCache = data || {};
      return namesCache;
    });
  return namesPromise;
}

export function strongpointLabelUrl(relativePath) {
  if (!relativePath) return "";
  return relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
}

/**
 * Extract label pixels from full vs bare SP PNGs (same diff as extract-sp-names.py).
 */
export function extractLabelDataUrl(fullImage, bareImage, label, mapSize = STRONGPOINT_MAP_SIZE) {
  if (!fullImage?.naturalWidth || !bareImage?.naturalWidth || !label) return null;

  const scale = fullImage.naturalWidth / mapSize;
  const left = Math.round((label.left / 100) * mapSize);
  const top = Math.round((label.top / 100) * mapSize);
  const width = Math.max(1, Math.round((label.width / 100) * mapSize));
  const height = Math.max(1, Math.round((label.height / 100) * mapSize));

  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = fullImage.naturalWidth;
  fullCanvas.height = fullImage.naturalHeight;
  const fullCtx = fullCanvas.getContext("2d", { willReadFrequently: true });
  fullCtx.drawImage(fullImage, 0, 0);

  const bareCanvas = document.createElement("canvas");
  bareCanvas.width = bareImage.naturalWidth;
  bareCanvas.height = bareImage.naturalHeight;
  const bareCtx = bareCanvas.getContext("2d", { willReadFrequently: true });
  bareCtx.drawImage(bareImage, 0, 0);

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const outCtx = out.getContext("2d");
  const outData = outCtx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = Math.min(fullImage.naturalWidth - 1, Math.round((left + x) * scale));
      const sy = Math.min(fullImage.naturalHeight - 1, Math.round((top + y) * scale));
      const p1 = fullCtx.getImageData(sx, sy, 1, 1).data;
      const p2 = bareCtx.getImageData(sx, sy, 1, 1).data;
      const i = (y * width + x) * 4;
      if (p1[3] > 20 && (p2[3] < 10 || p1[0] !== p2[0] || p1[1] !== p2[1] || p1[2] !== p2[2])) {
        outData.data[i] = p1[0];
        outData.data[i + 1] = p1[1];
        outData.data[i + 2] = p1[2];
        outData.data[i + 3] = p1[3];
      }
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return out.toDataURL();
}

export function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function resolveLabelSrc(label, fullImage, bareImage) {
  const assetUrl = strongpointLabelUrl(label?.image);
  if (assetUrl) {
    const prebuilt = await loadImage(assetUrl);
    if (prebuilt) return assetUrl;
  }
  return extractLabelDataUrl(fullImage, bareImage, label);
}
