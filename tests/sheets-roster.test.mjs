import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPlaceholderDisplayName,
  parseCompRecruitSheet,
  parseEclSheet,
} from "../functions/lib/sheets-roster.js";

describe("sheets-roster parsers", () => {
  it("parses ECL steam rows and merc situation", () => {
    const csv = `# Players,Player Name,Steam 64 ID,Merc Mainteam
1,KillerTomato,76561197964919183,BNT
2,LocalOnly,not-a-steam,BNT
3,CircleGuy,76561198065870287,
`;
    const parsed = parseEclSheet(csv);
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.skippedInvalid, 1);
    assert.equal(parsed.rows[0].situation, "merc");
    assert.equal(parsed.rows[0].notes, "Merc: BNT");
    assert.equal(parsed.rows[1].situation, "member");
    assert.deepEqual(parsed.rows[1].tournaments, ["ECL"]);
  });

  it("parses Comp recruit Steam64 + First Preference roles", () => {
    const csv = `Timestamp,What is your Discord Name?,What is your Steam/Epic/Gamepass ID?,What is your preferred role?  [Squad Leader],What is your preferred role?  [Infantry],What is your preferred role?  [MG],What is your preferred role?  [Commander],Recruit Thread
1,BaS5,76561198316231961,Second Preference,First Preference,I can play it,Do I have to?,Promoted
2,EpicOnly,a30907426dfd429a9a63e5034764367e,First Preference,First Preference,First Preference,First Preference,Created
3,alargejeff,76561198048942696,I can play it,I can play it,I can play it,First Preference,Created
`;
    const parsed = parseCompRecruitSheet(csv);
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.skippedInvalid, 1);
    assert.equal(parsed.rows[0].status, "active");
    assert.ok(parsed.rows[0].rosterRoles.includes("infantry"));
    assert.equal(parsed.rows[1].status, "trial");
    assert.ok(parsed.rows[1].rosterRoles.includes("commander"));
  });

  it("detects Player #### placeholders", () => {
    assert.equal(isPlaceholderDisplayName("Player 8626"), true);
    assert.equal(isPlaceholderDisplayName("The MtR"), false);
  });
});
