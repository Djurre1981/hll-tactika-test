import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultEnabledPrepTypes,
  normalizePrepCategory,
} from "../functions/lib/prep-task-types.js";
import {
  enrichPrepSlot,
  hasPrepToolLink,
  resolvePrepSlotStatus,
  sanitizePrepPlanBody,
} from "../functions/lib/event-prep-store.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("prep task types", () => {
  it("defaults comp to all types", () => {
    assert.equal(defaultEnabledPrepTypes("comp").length, 9);
  });

  it("defaults scrim to general, tank, routes, lineups", () => {
    assert.deepEqual(defaultEnabledPrepTypes("scrim"), [
      "general_strat",
      "tank_strat",
      "routes",
      "lineups",
    ]);
  });

  it("defaults practice to general only", () => {
    assert.deepEqual(defaultEnabledPrepTypes("practice"), ["general_strat"]);
  });

  it("normalizes strat prep categories", () => {
    assert.equal(normalizePrepCategory("tank"), "tank");
    assert.equal(normalizePrepCategory("invalid"), null);
  });
});

describe("event prep status resolution", () => {
  const event = {
    components: {
      stratIds: ["s1"],
      routePlanIds: ["r1"],
      lineupId: "l1",
    },
  };

  it("detects linked route and lineup", () => {
    assert.equal(hasPrepToolLink("routes", event, new Map()), true);
    assert.equal(hasPrepToolLink("lineups", event, new Map()), true);
    assert.equal(hasPrepToolLink("snipes", event, new Map()), false);
  });

  it("matches strat categories", () => {
    const categories = new Map([["s1", "tank"]]);
    assert.equal(hasPrepToolLink("tank_strat", event, categories), true);
    assert.equal(hasPrepToolLink("mg_strat", event, categories), false);
  });

  it("resolves not started, in progress, and done", () => {
    const slot = {
      taskType: "routes",
      enabled: true,
      primarySteamId: null,
      helperSteamIds: [],
      completedAt: null,
    };
    assert.equal(resolvePrepSlotStatus(slot, event, new Map()), "in_progress");

    const done = { ...slot, completedAt: "2026-08-01T00:00:00.000Z" };
    assert.equal(resolvePrepSlotStatus(done, event, new Map()), "done");

    const manual = {
      taskType: "snipes",
      enabled: true,
      primarySteamId: "76561198000000001",
      helperSteamIds: [],
      completedAt: null,
    };
    assert.equal(resolvePrepSlotStatus(manual, event, new Map()), "in_progress");
  });

  it("enriches slot labels", () => {
    const enriched = enrichPrepSlot(
      {
        taskType: "general_strat",
        enabled: true,
        primarySteamId: null,
        helperSteamIds: [],
        completedAt: null,
      },
      event,
      new Map([["s1", "general"]])
    );
    assert.equal(enriched.status, "in_progress");
    assert.equal(enriched.label, "General strat");
  });
});

describe("prep plan sanitize", () => {
  it("requires slots array", () => {
    assert.match(sanitizePrepPlanBody({}).error || "", /slots/i);
  });

  it("accepts valid slot payload", () => {
    const ok = sanitizePrepPlanBody({
      slots: [
        {
          taskType: "general_strat",
          enabled: true,
          primarySteamId: "76561198000000001",
          helperSteamIds: ["76561198000000002"],
        },
      ],
    });
    assert.equal(ok.slots.length, 1);
    assert.equal(ok.slots[0].taskType, "general_strat");
  });
});

describe("migrations 0027–0028", () => {
  it("adds strat prep_category", () => {
    const sql = readFileSync(join(root, "migrations/0027_strat_prep_category.sql"), "utf8");
    assert.match(sql, /prep_category/i);
  });

  it("creates event_prep_slots", () => {
    const sql = readFileSync(join(root, "migrations/0028_event_prep_slots.sql"), "utf8");
    assert.match(sql, /event_prep_slots/i);
    assert.match(sql, /task_type/i);
  });
});
