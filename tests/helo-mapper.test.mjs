/**
 * Unit tests for HeLO → Tactika event mapping.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  heloMatchToEvent,
  inferCircleFaction,
  mapHeloMapId,
  parseHeloDate,
  parseHeloScores,
} from "../scripts/lib/helo-mapper.mjs";

describe("helo-mapper map aliases", () => {
  it("maps known aliases", () => {
    assert.equal(mapHeloMapId("Hurtgen").mapId, "HurtgenV2");
    assert.equal(mapHeloMapId("SMDM").mapId, "SMDMV2");
    assert.equal(mapHeloMapId("SHD65V2").mapId, "SMDMV2");
    assert.equal(mapHeloMapId("Omaha Beach").mapId, "Omaha");
    assert.equal(mapHeloMapId("Elsenborn Ridge").mapId, "Elsenborn");
    assert.equal(mapHeloMapId("El Alamein").mapId, "ElAlamein");
  });

  it("passes through identity maps", () => {
    assert.equal(mapHeloMapId("PHL").mapId, "PHL");
    assert.equal(mapHeloMapId("SME").mapId, "SME");
  });
});

describe("helo-mapper scores and faction", () => {
  it("parses Circle-first scoreline", () => {
    const scores = parseHeloScores(["Circle", "PF"], "Circle", "4-1");
    assert.deepEqual(scores, { circleScore: 4, oppScore: 1, opponent: "PF" });
  });

  it("parses Circle-second scoreline", () => {
    const scores = parseHeloScores(["CHMA", "Circle"], "Circle", "3-2");
    assert.deepEqual(scores, { circleScore: 2, oppScore: 3, opponent: "CHMA" });
  });

  it("infers faction from victor_side", () => {
    assert.equal(inferCircleFaction("Axis", true), "axis");
    assert.equal(inferCircleFaction("Axis", false), "allies");
    assert.equal(inferCircleFaction("Allies", true), "allies");
    assert.equal(inferCircleFaction("Allies", false), "axis");
  });
});

describe("helo-mapper Circle-PF-2026-07-12", () => {
  const helo = {
    match_id: "Circle-PF-2026-07-12",
    teams: ["Circle", "PF"],
    date: { $date: 1783887403048 },
    duration: 90,
    gamemode: "warfare",
    result: "4-1",
    victor_side: "Axis",
    map: "PHL",
    type: "competitive",
    tournament: "HCA",
  };

  it("parses kickoff date", () => {
    const d = parseHeloDate(helo.date);
    assert.ok(d);
    assert.equal(d.toISOString(), "2026-07-12T20:16:43.048Z");
  });

  it("maps to expected calendar event", () => {
    const mapped = heloMatchToEvent(helo);
    assert.ok(!mapped.error);
    assert.equal(mapped.heloMatchId, "Circle-PF-2026-07-12");
    assert.equal(mapped.event.eventType, "comp");
    assert.equal(mapped.event.title, "Comp vs PF");
    assert.equal(mapped.event.startsAt, "2026-07-12T20:16:43.048Z");
    assert.equal(mapped.event.endsAt, "2026-07-12T21:46:43.048Z");
    assert.equal(mapped.event.match.opponent, "PF");
    assert.equal(mapped.event.match.mapId, "PHL");
    assert.equal(mapped.event.match.faction, "axis");
    assert.equal(mapped.event.match.result, "win");
    assert.equal(mapped.event.match.team, "sr");
    assert.equal(mapped.event.match.date, "2026-07-12");
    assert.equal(mapped.event.match.heloMatchId, "Circle-PF-2026-07-12");
    assert.match(mapped.event.match.heloUrl, /Circle-PF-2026-07-12/);
    assert.match(mapped.event.description, /Score: 4-1/);
    assert.match(mapped.event.description, /Tournament: HCA/);
  });
});

describe("helo-mapper Circle Jr (◯)", () => {
  const JR = "\u25EF";
  const helo = {
    match_id: `${JR}-CHMA-2026-05-02`,
    teams: [JR, "CHMA"],
    date: { $date: 1777708800000 },
    duration: 90,
    result: "3-2",
    victor_side: "Allies",
    map: "SMDM",
    type: "friendly",
  };

  it("maps Jr tag to match.team jr and Jr title prefix", () => {
    const mapped = heloMatchToEvent(helo, { teamTag: JR });
    assert.ok(!mapped.error);
    assert.equal(mapped.event.match.team, "jr");
    assert.equal(mapped.event.title, "Jr Scrim vs CHMA");
    assert.equal(mapped.event.match.opponent, "CHMA");
    assert.equal(mapped.event.match.mapId, "SMDMV2");
    assert.equal(mapped.event.match.result, "win");
    assert.equal(mapped.event.match.faction, "allies");
  });

  it("accepts circle-jr alias via resolve in mapper teamTag helo char", () => {
    const mapped = heloMatchToEvent(helo, { teamTag: "jr" });
    assert.ok(!mapped.error);
    assert.equal(mapped.event.match.team, "jr");
  });
});
