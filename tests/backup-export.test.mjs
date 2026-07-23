import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { insertStatement, sqlLiteral } from "../functions/lib/d1-backup.js";
import { buildKvTextBackup } from "../functions/lib/kv-backup.js";

describe("d1-backup sqlLiteral", () => {
  it("escapes strings and nulls", () => {
    assert.equal(sqlLiteral(null), "NULL");
    assert.equal(sqlLiteral(42), "42");
    assert.equal(sqlLiteral("O'Brien"), "'O''Brien'");
    assert.equal(sqlLiteral(true), "1");
  });

  it("builds insert statements", () => {
    const sql = insertStatement("users", ["steam_id", "role"], {
      steam_id: "76561198000000000",
      role: "owner",
    });
    assert.match(sql, /^INSERT INTO "users"/);
    assert.match(sql, /'76561198000000000'/);
    assert.match(sql, /'owner'/);
  });
});

describe("kv-backup buildKvTextBackup", () => {
  it("keeps text/json keys and skips yjs + binary", async () => {
    const textEncoder = new TextEncoder();
    const store = new Map([
      ["pins", textEncoder.encode(JSON.stringify({ defaultMapId: "SMDMV2", pins: {} }))],
      ["users", textEncoder.encode(JSON.stringify({ users: [], revoked: [] }))],
      ["yjs:strat:abc:slide:1", new Uint8Array([0, 1, 2, 3])],
      ["legacy-blob", new Uint8Array([1, 0, 2])],
      ["note", textEncoder.encode("plain text")],
    ]);

    const kv = {
      async list() {
        return {
          keys: [...store.keys()].map((name) => ({ name })),
          list_complete: true,
        };
      },
      async get(name, type) {
        assert.equal(type, "arrayBuffer");
        const value = store.get(name);
        if (!value) return null;
        return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
      },
    };

    const backup = await buildKvTextBackup(kv, {
      exportedAt: "2026-07-23T00:00:00.000Z",
      exportedBy: "76561198000000000",
    });

    assert.equal(backup.keyCount, 3);
    assert.equal(backup.entries.pins.defaultMapId, "SMDMV2");
    assert.equal(backup.entries.note, "plain text");
    assert.equal(backup.skippedCount, 2);
    assert.ok(backup.skipped.some((item) => item.key.startsWith("yjs:")));
    assert.ok(backup.skipped.some((item) => item.reason === "binary"));
  });
});
