/**
 * T2 API sanitize layer — maps to playbook verify: scrim vs practice payloads.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { sanitizeEventBody } from "../functions/api/events.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("T2 — sanitizeEventBody (API)", () => {
  it("create payload includes empty match by default", () => {
    const result = sanitizeEventBody({
      title: "Practice night",
      startsAt: "2026-07-23T19:00:00.000Z",
      eventType: "practice",
    });

    assert.equal(result.error, undefined);
    assert.deepEqual(result.event.match, {
      date: "",
      faction: "",
      mapId: "",
      startingPoint: "",
      opponent: "",
      result: "",
      heloMatchId: "",
      heloUrl: "",
      crconGameId: "",
      crconUrl: "",
      participantSteamIds: [],
    });
  });

  it("create scrim payload normalizes match metadata", () => {
    const result = sanitizeEventBody({
      title: "Comp vs 42nd",
      startsAt: "2026-07-23T19:00:00.000Z",
      eventType: "scrim",
      match: {
        opponent: "  42nd  ",
        mapId: "Foy",
        faction: "allies",
        startingPoint: "01",
        result: "win",
      },
    });

    assert.equal(result.event.match.opponent, "42nd");
    assert.equal(result.event.match.mapId, "Foy");
    assert.equal(result.event.match.faction, "allies");
    assert.equal(result.event.match.startingPoint, "01");
    assert.equal(result.event.match.result, "win");
  });

  it("partial PATCH omits match unless provided (preserves via store merge)", () => {
    const result = sanitizeEventBody(
      { title: "Renamed scrim" },
      { partial: true }
    );

    assert.equal(result.event.title, "Renamed scrim");
    assert.equal(result.event.match, undefined);
  });

  it("partial PATCH can replace match only", () => {
    const result = sanitizeEventBody(
      {
        match: {
          opponent: "New foe",
          mapId: "Omaha",
          faction: "axis",
        },
      },
      { partial: true }
    );

    assert.equal(result.event.match.opponent, "New foe");
    assert.equal(result.event.match.mapId, "Omaha");
    assert.equal(result.event.match.faction, "axis");
  });
});

describe("T2 — auth guards unchanged", () => {
  it("POST /api/events still requires editor", () => {
    const source = readFileSync(join(root, "functions/api/events.js"), "utf8");
    assert.match(source, /onRequestPost[\s\S]*requireEditor/);
  });

  it("PATCH /api/events/:id still requires editor", () => {
    const source = readFileSync(join(root, "functions/api/events/[eventId].js"), "utf8");
    assert.match(source, /onRequestPatch[\s\S]*requireEditor/);
  });

  it("GET /api/events still requires auth only", () => {
    const source = readFileSync(join(root, "functions/api/events.js"), "utf8");
    const getHandler = source.match(/export async function onRequestGet[\s\S]*?^}/m)?.[0] || "";
    assert.match(getHandler, /requireAuth/);
    assert.doesNotMatch(getHandler, /requireEditor/);
  });

  it("Calendar UI gates edit form on canEditEvents", () => {
    const calendarPage = readFileSync(join(root, "src/features/calendar/CalendarPage.jsx"), "utf8");
    const dayDetails = readFileSync(join(root, "src/features/calendar/DayDetails.jsx"), "utf8");

    assert.match(calendarPage, /canEditEvents\(user\.role\)/);
    assert.match(calendarPage, /if \(!canEdit\) return;/);
    assert.match(dayDetails, /to=\{`\/events\/\$\{event\.id\}`\}/);
    assert.match(dayDetails, /canEdit \?/);
  });
});
