import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertToolContentEditable,
  canManageToolLock,
  isToolLockOnlyUpdate,
} from "../functions/lib/tool-lock.js";

describe("tool-lock helpers", () => {
  it("allows creator, admin, and owner to manage lock", () => {
    assert.equal(canManageToolLock("111", "editor", "111"), true);
    assert.equal(canManageToolLock("111", "admin", "222"), true);
    assert.equal(canManageToolLock("111", "owner", "222"), true);
    assert.equal(canManageToolLock("111", "editor", "222"), false);
  });

  it("detects lock-only updates", () => {
    assert.equal(isToolLockOnlyUpdate({ locked: true, lockedBy: "111" }), true);
    assert.equal(isToolLockOnlyUpdate({ title: "x" }), false);
  });

  it("blocks content edits while locked unless lock-only", () => {
    const locked = { locked: true, createdBy: "111" };
    assert.equal(assertToolContentEditable(locked, "111", "editor", { title: "nope" }).status, 423);
    assert.ok(assertToolContentEditable(locked, "111", "editor", { locked: false }).ok);
    assert.equal(assertToolContentEditable(locked, "222", "editor", { locked: false }).status, 423);
  });
});
