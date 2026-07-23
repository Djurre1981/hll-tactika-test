/**
 * T2 calendar display helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatEventMatchSummary,
  isMatchEventType,
} from "../src/features/calendar/calendar-utils.js";

describe("T2 — isMatchEventType", () => {
  it("treats scrim and comp as match events", () => {
    assert.equal(isMatchEventType("scrim"), true);
    assert.equal(isMatchEventType("comp"), true);
  });

  it("treats practice and other as non-match events", () => {
    assert.equal(isMatchEventType("practice"), false);
    assert.equal(isMatchEventType("other"), false);
  });
});

describe("T2 — formatEventMatchSummary", () => {
  it("returns empty string when no match facts", () => {
    assert.equal(formatEventMatchSummary({ match: {} }), "");
    assert.equal(formatEventMatchSummary({}), "");
  });

  it("builds a readable one-liner for day list", () => {
    const summary = formatEventMatchSummary({
      match: {
        opponent: "42nd",
        mapId: "Foy",
        faction: "allies",
        startingPoint: "01",
        result: "win",
      },
    });

    assert.match(summary, /vs 42nd/);
    assert.match(summary, /Foy/);
    assert.match(summary, /Allies/);
    assert.match(summary, /HQ mid/);
    assert.match(summary, /Win/);
  });
});
