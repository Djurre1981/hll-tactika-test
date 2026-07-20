/**
 * Lightweight MP4/MOV HEVC detection (Workers-safe, no deps).
 * Mirrors climbing-guide-v1/js/utils/video-hevc.js.
 */

const HEVC_SAMPLE_ENTRIES = new Set(["hvc1", "hev1", "hvcC", "hevC"]);

function readType(bytes, offset) {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  );
}

function readU32(bytes, offset) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function walkBoxes(bytes, start, end, visit) {
  let offset = start;
  while (offset + 8 <= end) {
    let size = readU32(bytes, offset);
    const type = readType(bytes, offset + 4);
    let header = 8;

    if (size === 1) {
      if (offset + 16 > end) break;
      const hi = readU32(bytes, offset + 8);
      const lo = readU32(bytes, offset + 12);
      size = hi * 0x100000000 + lo;
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }

    if (size < header || offset + size > end) break;

    const contentStart = offset + header;
    const contentEnd = offset + size;
    if (visit(type, contentStart, contentEnd) === true) {
      return true;
    }
    offset = contentEnd;
  }
  return false;
}

function stsdHasHevc(bytes, contentStart, contentEnd) {
  if (contentEnd - contentStart < 8) return false;
  const entryCount = readU32(bytes, contentStart + 4);
  let offset = contentStart + 8;
  for (let i = 0; i < entryCount && offset + 8 <= contentEnd; i += 1) {
    const size = readU32(bytes, offset);
    const codec = readType(bytes, offset + 4);
    if (HEVC_SAMPLE_ENTRIES.has(codec)) return true;
    if (size < 8) break;
    offset += size;
  }
  return false;
}

export function mp4BufferHasHevc(bytes) {
  if (!bytes || bytes.length < 16) return false;

  let found = false;
  const visitMoovSubtree = (type, contentStart, contentEnd) => {
    if (type === "stsd") {
      if (stsdHasHevc(bytes, contentStart, contentEnd)) {
        found = true;
        return true;
      }
      return false;
    }
    if (
      type === "moov" ||
      type === "trak" ||
      type === "mdia" ||
      type === "minf" ||
      type === "stbl"
    ) {
      return walkBoxes(bytes, contentStart, contentEnd, visitMoovSubtree);
    }
    return false;
  };

  walkBoxes(bytes, 0, bytes.length, (type, contentStart, contentEnd) => {
    if (type === "moov") {
      return walkBoxes(bytes, contentStart, contentEnd, visitMoovSubtree);
    }
    return false;
  });

  if (found) return true;

  for (let i = 0; i < bytes.length - 4; i += 1) {
    const fourcc = readType(bytes, i);
    if (fourcc === "hvc1" || fourcc === "hev1") return true;
  }
  return false;
}

export async function uploadedFileLooksLikeHevc(file, { maxScanBytes = 4 * 1024 * 1024 } = {}) {
  if (!file || typeof file.size !== "number" || file.size <= 0) return false;

  const name = String(file.name || "").toLowerCase();
  if (/\.(webm|ogg|ogv)$/i.test(name)) return false;

  const size = file.size;
  const slices = [];
  if (size <= maxScanBytes * 2) {
    slices.push(file.slice(0, size));
  } else {
    slices.push(file.slice(0, maxScanBytes));
    slices.push(file.slice(size - maxScanBytes, size));
  }

  for (const slice of slices) {
    const bytes = new Uint8Array(await slice.arrayBuffer());
    if (mp4BufferHasHevc(bytes)) return true;
  }
  return false;
}
