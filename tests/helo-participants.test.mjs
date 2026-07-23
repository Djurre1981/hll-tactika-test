import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eventHasParticipant,
  filterMatchHistory,
} from "../src/features/records/match-history-utils.js";
import { extractCircleParticipantSteamIds } from "../scripts/lib/helo-participants.mjs";
import { normalizeParticipantSteamIds } from "../functions/lib/strat-fields.js";

describe("participant Steam IDs", () => {
  it("normalizes Steam64 lists", () => {
    assert.deepEqual(
      normalizeParticipantSteamIds([
        "76561198014575147",
        " bad ",
        "76561198014575147",
        "76561198884648099",
      ]),
      ["76561198014575147", "76561198884648099"]
    );
  });

  it("extracts Circle-side IDs from HeLO player_stats", () => {
    const ids = extractCircleParticipantSteamIds(
      {
        player_stats: {
          "76561198014575147": { side: "Axis", name: "◯ | A" },
          "76561198884648099": { side: "Allies", name: "PF | B" },
          "76561198165751514": { side: "Axis", name: "◯ | C" },
        },
      },
      "axis"
    );
    assert.deepEqual(ids, ["76561198014575147", "76561198165751514"]);
  });

  it("filters match history by participant", () => {
    const events = [
      {
        id: "a",
        startsAt: "2026-07-12T20:00:00.000Z",
        eventType: "comp",
        match: { result: "win", participantSteamIds: ["76561198014575147"] },
      },
      {
        id: "b",
        startsAt: "2026-07-11T20:00:00.000Z",
        eventType: "comp",
        match: { result: "loss", participantSteamIds: ["76561198884648099"] },
      },
    ];
    const mine = filterMatchHistory(events, {
      participantSteamId: "76561198014575147",
    });
    assert.equal(mine.length, 1);
    assert.equal(mine[0].id, "a");
    assert.equal(eventHasParticipant(events[0], "76561198014575147"), true);
    assert.equal(eventHasParticipant(events[1], "76561198014575147"), false);
  });
});
