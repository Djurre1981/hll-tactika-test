/**
 * Export text/JSON keys from PINS_KV. Skips Yjs binary snapshots (yjs:*).
 */

const YJS_PREFIX = "yjs:";
const LIST_PAGE_SIZE = 1000;

function looksLikeBinary(bytes) {
  if (!bytes || bytes.length === 0) {
    return false;
  }
  // Null bytes are common in Yjs / binary blobs and invalid in JSON/settings text.
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 0) {
      return true;
    }
  }
  return false;
}

function decodeUtf8OrNull(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function parseStoredValue(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * @param {KVNamespace} kv
 * @param {{ exportedBy?: string, exportedAt?: string }} [meta]
 */
export async function buildKvTextBackup(kv, meta = {}) {
  const exportedAt = meta.exportedAt || new Date().toISOString();
  const entries = {};
  const skipped = [];
  let cursor;

  do {
    const page = await kv.list({ cursor, limit: LIST_PAGE_SIZE });
    for (const key of page.keys || []) {
      const name = String(key.name || "");
      if (!name) {
        continue;
      }
      if (name.startsWith(YJS_PREFIX)) {
        skipped.push({ key: name, reason: "yjs-binary" });
        continue;
      }

      const buffer = await kv.get(name, "arrayBuffer");
      if (buffer == null) {
        skipped.push({ key: name, reason: "missing" });
        continue;
      }

      const bytes = new Uint8Array(buffer);
      if (looksLikeBinary(bytes)) {
        skipped.push({ key: name, reason: "binary" });
        continue;
      }

      const text = decodeUtf8OrNull(bytes);
      if (text == null) {
        skipped.push({ key: name, reason: "non-utf8" });
        continue;
      }

      entries[name] = parseStoredValue(text);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return {
    source: "PINS_KV",
    exportedAt,
    exportedBy: meta.exportedBy || null,
    keyCount: Object.keys(entries).length,
    skippedCount: skipped.length,
    skipped,
    entries,
  };
}
