import { apiClient } from "../../lib/api-client.js";
import { rememberMapId } from "../strats/editor/mapIds.js";
import { composeHllMapBlob } from "./composeHllMapImage.js";

async function uploadComposedMap(blob, mapId) {
  const form = new FormData();
  form.append("file", blob, `hll-map-${mapId}.jpg`);
  const result = await apiClient("/uploads/image", {
    method: "POST",
    body: form,
  });
  return result.url;
}

/**
 * Set the kernel page image to a composed HLL tactical map (base + optional overlays).
 * Uploads the PNG to R2 so scene JSON stays within D1 size limits.
 */
export async function insertHllMapPage(
  kernel,
  mapId,
  { showGrid = false, showStrongpoints = false } = {}
) {
  if (!kernel || !mapId) return null;

  const blob = await composeHllMapBlob(mapId, { showGrid, showStrongpoints });
  const url = await uploadComposedMap(blob, mapId);
  kernel.setPageImage(url, { mapId, showOverlays: false });
  kernel.fitToView();
  rememberMapId(mapId);
  return url;
}
