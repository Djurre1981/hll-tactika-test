import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPlayerDossier } from "../src/features/management/player-dossier-utils.js";
import { getCompStatus, isPoolStatus } from "../src/features/management/rosterRoles.js";

describe("comp roster status", () => {
  it("includes na status", () => {
    assert.equal(getCompStatus("na").label, "NA");
    assert.equal(isPoolStatus("active"), true);
    assert.equal(isPoolStatus("trial"), true);
    assert.equal(isPoolStatus("na"), false);
    assert.equal(isPoolStatus("inactive"), false);
  });
});

describe("player dossier", () => {
  it("builds match list and form from participation", () => {
    const member = { steamId: "76561198014575147", displayName: "Alpha" };
    const events = [
      {
        id: "e1",
        title: "Comp vs PF",
        startsAt: "2026-07-12T20:00:00.000Z",
        eventType: "comp",
        match: {
          result: "win",
          opponent: "PF",
          mapId: "PHL",
          participantSteamIds: ["76561198014575147"],
        },
      },
      {
        id: "e2",
        title: "Scrim vs X",
        startsAt: "2026-06-01T20:00:00.000Z",
        eventType: "scrim",
        match: {
          result: "loss",
          opponent: "X",
          participantSteamIds: ["76561198014575147"],
        },
      },
    ];
    const dossier = buildPlayerDossier(
      member,
      events,
      { "76561198014575147": { kills: 20, deaths: 10, combatPoints: 900, matches: 2 } },
      new Date("2026-07-20T00:00:00.000Z")
    );
    assert.equal(dossier.gamesPlayed, 2);
    assert.equal(dossier.winRate, 50);
    assert.equal(dossier.kd, 2);
    assert.equal(dossier.matches.length, 2);
    assert.equal(dossier.lastGame.id, "e1");
  });
});
