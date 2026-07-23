/**
 * Extract Circle-side Steam ID64s from a HeLO match payload.
 * HeLO player_stats keys are Steam64; `side` is "Axis" | "Allies".
 * Same IDs appear on CRCON scoreboards for the linked game.
 */
import { normalizeParticipantSteamIds } from "../../functions/lib/strat-fields.js";

/**
 * @param {object} heloMatch
 * @param {"axis"|"allies"|string} faction Circle faction for this match
 * @returns {string[]}
 */
export function extractCircleParticipantSteamIds(heloMatch, faction) {
  const sideWanted =
    faction === "axis" ? "Axis" : faction === "allies" ? "Allies" : "";
  const stats = heloMatch?.player_stats;
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
    return [];
  }

  const ids = [];
  for (const [steamId, row] of Object.entries(stats)) {
    if (!row || typeof row !== "object") continue;
    if (sideWanted && String(row.side || "") !== sideWanted) continue;
    ids.push(steamId);
  }
  return normalizeParticipantSteamIds(ids);
}

/**
 * From CRCON get_map_scoreboard `result.player_stats` array.
 * Prefer entries whose team matches Circle faction (axis/allies).
 * @param {object} crconDetail
 * @param {"axis"|"allies"|string} faction
 */
export function extractCircleParticipantsFromCrcon(crconDetail, faction) {
  const rows = crconDetail?.player_stats || crconDetail?.result?.player_stats;
  if (!Array.isArray(rows)) return [];

  const sideWanted =
    faction === "axis" ? "axis" : faction === "allies" ? "allies" : "";

  const ids = [];
  for (const row of rows) {
    const steamId = String(row?.player_id || row?.steam_id || row?.steamId || "").trim();
    if (!steamId) continue;
    const team = String(row?.team || row?.side || row?.faction || "")
      .trim()
      .toLowerCase();
    if (sideWanted) {
      const isAxis = team === "axis" || team === "ger" || team === "germany";
      const isAllies =
        team === "allies" || team === "allied" || team === "us" || team === "usa";
      if (faction === "axis" && !isAxis) continue;
      if (faction === "allies" && !isAllies) continue;
    }
    ids.push(steamId);
  }
  return normalizeParticipantSteamIds(ids);
}
