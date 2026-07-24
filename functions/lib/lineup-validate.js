import {
  countPlayingSlots,
  countSquadBudget,
  sanitizeRosterSize,
} from "./lineup-layouts.js";

const SQUAD_TYPE_CAPS = {
  infantry: 6,
  armor: 3,
  recon: 2,
};

const MAX_ARMOR_SQUADS = 3;
const MAX_RECON_SQUADS = 2;
const MAX_SQUADS = 20;

export { MAX_ARMOR_SQUADS, MAX_RECON_SQUADS, MAX_SQUADS, SQUAD_TYPE_CAPS };

function collectSquads(layout) {
  const squads = [];
  for (const sec of layout.sectors || []) {
    for (const sq of sec.squads || []) {
      squads.push(sq);
    }
  }
  return squads;
}

function collectPlayingSteamIds(layout) {
  const ids = [];
  for (const sp of layout.specials || []) {
    if (sp.role === "streamer") continue;
    if (sp.steamId) ids.push(String(sp.steamId));
  }
  for (const sq of collectSquads(layout)) {
    for (const slot of sq.slots || []) {
      if (slot.steamId) ids.push(String(slot.steamId));
    }
  }
  return ids;
}

function infantrySteamIds(layout) {
  const set = new Set();
  for (const sq of collectSquads(layout)) {
    if (sq.type !== "infantry") continue;
    for (const slot of sq.slots || []) {
      if (slot.steamId) set.add(String(slot.steamId));
    }
  }
  return set;
}

/**
 * Validate a lineup layout against hard game + product rules.
 * @returns {{ ok: true } | { error: string, status?: number }}
 */
export function validateLineupLayout(layout, { rosterSize, confirmedSteamIds } = {}) {
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    return { error: "Invalid layout", status: 400 };
  }

  const sizeCheck = sanitizeRosterSize(rosterSize ?? layout.rosterSize);
  if (sizeCheck.error) return { error: sizeCheck.error, status: 400 };
  const expectedSize = sizeCheck.rosterSize;

  if (Number(layout.rosterSize) !== expectedSize) {
    return { error: `layout.rosterSize must be ${expectedSize}`, status: 400 };
  }

  const playingSlots = countPlayingSlots(layout);
  if (playingSlots > expectedSize) {
    return {
      error: `Playing slots (${playingSlots}) exceed roster size (${expectedSize})`,
      status: 400,
    };
  }
  if (playingSlots < 1) {
    return { error: "Layout needs at least one playing slot", status: 400 };
  }

  const squadBudget = countSquadBudget(layout);
  if (squadBudget > MAX_SQUADS) {
    return { error: `Too many squads (${squadBudget}); max is ${MAX_SQUADS}`, status: 400 };
  }

  const squads = collectSquads(layout);
  let armorCount = 0;
  let reconCount = 0;

  for (const sq of squads) {
    const type = String(sq.type || "");
    const cap = SQUAD_TYPE_CAPS[type];
    if (!cap) {
      return { error: `Unknown squad type: ${type || "(empty)"}`, status: 400 };
    }
    const size = (sq.slots || []).length;
    if (size < 1 || size > cap) {
      return {
        error: `${type} squad "${sq.label || sq.id}" has ${size} players; max is ${cap}`,
        status: 400,
      };
    }
    if (type === "armor") armorCount += 1;
    if (type === "recon") reconCount += 1;
  }

  if (armorCount > MAX_ARMOR_SQUADS) {
    return { error: `Too many armor squads (${armorCount}); max is ${MAX_ARMOR_SQUADS}`, status: 400 };
  }
  if (reconCount > MAX_RECON_SQUADS) {
    return { error: `Too many recon squads (${reconCount}); max is ${MAX_RECON_SQUADS}`, status: 400 };
  }

  const playingIds = collectPlayingSteamIds(layout);
  const assignedPlaying = playingIds.length;
  if (assignedPlaying > expectedSize) {
    return {
      error: `Too many players assigned (${assignedPlaying}); roster size is ${expectedSize}`,
      status: 400,
    };
  }

  const seen = new Set();
  for (const id of playingIds) {
    if (seen.has(id)) {
      return { error: `Player ${id} is assigned to more than one playing slot`, status: 400 };
    }
    seen.add(id);
  }

  const reserveIds = (layout.reserves || [])
    .map((r) => (r?.steamId ? String(r.steamId) : ""))
    .filter(Boolean);
  for (const id of reserveIds) {
    if (seen.has(id)) {
      return { error: `Player ${id} cannot be in both lineup and reserves`, status: 400 };
    }
    if (seen.has(`reserve:${id}`)) {
      return { error: `Player ${id} appears twice in reserves`, status: 400 };
    }
    seen.add(`reserve:${id}`);
  }

  if (confirmedSteamIds) {
    const confirmed = new Set([...confirmedSteamIds].map(String));
    for (const id of playingIds) {
      if (!confirmed.has(id)) {
        return {
          error: `Player ${id} is not RSVP confirmed for this event`,
          status: 400,
        };
      }
    }
    for (const id of reserveIds) {
      if (!confirmed.has(id)) {
        return {
          error: `Reserve ${id} is not RSVP confirmed for this event`,
          status: 400,
        };
      }
    }
  }

  const infantry = infantrySteamIds(layout);
  const nodeBlocks = layout.nodes || {};
  for (const [name, block] of Object.entries(nodeBlocks)) {
    if (!block || typeof block !== "object") {
      return { error: `Invalid nodes block: ${name}`, status: 400 };
    }
    for (const ns of block.slots || []) {
      if (!ns.steamId) continue;
      const sid = String(ns.steamId);
      if (!infantry.has(sid)) {
        return {
          error: `Nodes ${name}: ${sid} must already be on an infantry squad`,
          status: 400,
        };
      }
    }
  }

  return { ok: true };
}

export function isLineupAutoLocked(lineup, event) {
  if (lineup?.locked) return true;
  const endsAt = event?.endsAt;
  if (!endsAt) return false;
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end)) return false;
  return Date.now() >= end;
}
