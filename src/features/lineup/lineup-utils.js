/** Client helpers for LineUp layout mutations (immutable). */

import { SECTOR_TO_NODES, createSquadTemplate, countPlayingSlots, countSquadBudget } from "../../../functions/lib/lineup-layouts.js";
import {
  collectPlayingSteamIds,
  countFilledPlayingSlots,
  syncReservesWhenFull,
} from "../../../functions/lib/lineup-reserves.js";
import {
  MAX_ARMOR_SQUADS,
  MAX_RECON_SQUADS,
  MAX_SQUADS,
} from "../../../functions/lib/lineup-validate.js";

export {
  collectPlayingSteamIds,
  countFilledPlayingSlots,
  countSquadBudget,
  syncReservesWhenFull,
  MAX_SQUADS,
};

export function deepCloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout || {}));
}

export function collectAssignedSteamIds(layout) {
  const ids = collectPlayingSteamIds(layout);
  for (const r of layout?.reserves || []) {
    if (r.steamId) ids.add(String(r.steamId));
  }
  return ids;
}

/** Squads (budget units) that have at least one player assigned. */
export function countFilledSquads(layout) {
  let n = 0;
  for (const sp of layout?.specials || []) {
    if (sp.countsAsSquad && sp.steamId) n += 1;
  }
  for (const sec of layout?.sectors || []) {
    for (const sq of sec.squads || []) {
      if ((sq.slots || []).some((slot) => slot.steamId)) n += 1;
    }
  }
  return n;
}

/** True if a drop target is an empty playing slot (not reserve). */
export function isEmptyPlayingTarget(layout, targetKey) {
  if (!targetKey || targetKey === "reserve") return false;
  if (targetKey.startsWith("special:")) {
    const id = targetKey.slice(8);
    const sp = (layout?.specials || []).find((s) => s.id === id);
    if (!sp || sp.role === "streamer") return false;
    return !sp.steamId;
  }
  if (targetKey.startsWith("slot:")) {
    const parts = targetKey.split(":");
    const squadId = parts[1];
    const slotId = parts.slice(2).join(":");
    for (const sec of layout?.sectors || []) {
      for (const sq of sec.squads || []) {
        if (sq.id !== squadId) continue;
        const slot = (sq.slots || []).find((s) => s.id === slotId);
        return Boolean(slot && !slot.steamId);
      }
    }
  }
  return false;
}

function findInfantryPlacement(layout, steamId) {
  const id = String(steamId);
  for (const sec of layout.sectors || []) {
    for (const sq of sec.squads || []) {
      if (sq.type !== "infantry") continue;
      for (const slot of sq.slots || []) {
        if (String(slot.steamId) === id) {
          const sl = (sq.slots || []).find((s) => s.role === "sl");
          return {
            sectorId: sec.id,
            squadId: sq.id,
            role: slot.role,
            slSteamId: sl?.steamId ? String(sl.steamId) : null,
            slDisplayName: sl?.displayName || "",
          };
        }
      }
    }
  }
  return null;
}

/**
 * Keep nodes overlay in sync with infantry Support/Engineer assignments.
 * - Support/Engineer on infantry → occupy a matching nodes slot (prefer sector HQ)
 * - Each nodes assignee gets SL-for-nodes from their infantry squad SL
 * - Clear nodes rows whose player is no longer Support/Engineer on infantry
 */
export function syncNodesFromInfantry(layout) {
  if (!layout.nodes) return layout;

  const taskPlayers = [];
  for (const sec of layout.sectors || []) {
    for (const sq of sec.squads || []) {
      if (sq.type !== "infantry") continue;
      for (const slot of sq.slots || []) {
        if (!slot.steamId) continue;
        if (slot.role !== "support" && slot.role !== "engineer") continue;
        const sl = (sq.slots || []).find((s) => s.role === "sl");
        taskPlayers.push({
          steamId: String(slot.steamId),
          displayName: slot.displayName || "",
          role: slot.role,
          preferredBlock: SECTOR_TO_NODES[sec.id] || "middle",
          slSteamId: sl?.steamId ? String(sl.steamId) : null,
          slDisplayName: sl?.displayName || "",
        });
      }
    }
  }

  const stillAssigned = new Set(taskPlayers.map((p) => p.steamId));

  for (const block of Object.values(layout.nodes)) {
    for (const ns of block.slots || []) {
      if (ns.steamId && !stillAssigned.has(String(ns.steamId))) {
        ns.steamId = null;
        ns.displayName = "";
        ns.slSteamId = null;
        ns.slDisplayName = "";
      }
    }
  }

  for (const player of taskPlayers) {
    let existing = null;
    for (const block of Object.values(layout.nodes)) {
      for (const ns of block.slots || []) {
        if (String(ns.steamId) === player.steamId) {
          existing = ns;
          break;
        }
      }
      if (existing) break;
    }

    if (existing) {
      if (existing.role !== player.role) {
        existing.steamId = null;
        existing.displayName = "";
        existing.slSteamId = null;
        existing.slDisplayName = "";
        existing = null;
      }
    }

    if (!existing) {
      const order = [
        player.preferredBlock,
        "north",
        "middle",
        "south",
      ].filter((v, i, a) => a.indexOf(v) === i);

      for (const key of order) {
        const block = layout.nodes[key];
        if (!block) continue;
        const free = (block.slots || []).find(
          (ns) => ns.role === player.role && !ns.steamId
        );
        if (free) {
          existing = free;
          break;
        }
      }
    }

    if (existing) {
      existing.steamId = player.steamId;
      existing.displayName = player.displayName;
      existing.slSteamId = player.slSteamId;
      existing.slDisplayName = player.slDisplayName;
    }
  }

  for (const block of Object.values(layout.nodes)) {
    for (const ns of block.slots || []) {
      if (!ns.steamId) {
        ns.slSteamId = null;
        ns.slDisplayName = "";
        continue;
      }
      const place = findInfantryPlacement(layout, ns.steamId);
      if (place) {
        ns.slSteamId = place.slSteamId;
        ns.slDisplayName = place.slDisplayName;
      }
    }
  }

  return layout;
}

function withPostAssignSync(layout, confirmedPlayers, rosterSize) {
  syncNodesFromInfantry(layout);
  syncReservesWhenFull(layout, confirmedPlayers, rosterSize);
  return layout;
}

export function assignToSpecial(layout, specialId, player, opts = {}) {
  const next = deepCloneLayout(layout);
  const sp = (next.specials || []).find((s) => s.id === specialId);
  if (!sp) return { error: "Special slot not found" };
  clearPlayer(next, player.steamId);
  sp.steamId = player.steamId;
  sp.displayName = player.displayName || "";
  sp.present = Boolean(sp.present);
  withPostAssignSync(next, opts.confirmedPlayers, opts.rosterSize ?? next.rosterSize);
  return { layout: next };
}

export function assignToSlot(layout, squadId, slotId, player, opts = {}) {
  const next = deepCloneLayout(layout);
  let target = null;
  for (const sec of next.sectors || []) {
    for (const sq of sec.squads || []) {
      if (sq.id !== squadId) continue;
      target = (sq.slots || []).find((s) => s.id === slotId);
    }
  }
  if (!target) return { error: "Slot not found" };
  clearPlayer(next, player.steamId);
  target.steamId = player.steamId;
  target.displayName = player.displayName || "";
  target.present = Boolean(target.present);
  withPostAssignSync(next, opts.confirmedPlayers, opts.rosterSize ?? next.rosterSize);
  return { layout: next };
}

export function assignToReserve(layout, player, opts = {}) {
  const next = deepCloneLayout(layout);
  clearPlayer(next, player.steamId);
  next.reserves = next.reserves || [];
  next.reserves.push({
    steamId: player.steamId,
    displayName: player.displayName || "",
    present: false,
  });
  withPostAssignSync(next, opts.confirmedPlayers, opts.rosterSize ?? next.rosterSize);
  return { layout: next };
}

export function clearPlayer(layout, steamId) {
  if (!steamId) return;
  const id = String(steamId);
  for (const sp of layout.specials || []) {
    if (String(sp.steamId) === id) {
      sp.steamId = null;
      sp.displayName = "";
      sp.present = false;
    }
  }
  for (const sec of layout.sectors || []) {
    for (const sq of sec.squads || []) {
      for (const slot of sq.slots || []) {
        if (String(slot.steamId) === id) {
          slot.steamId = null;
          slot.displayName = "";
          slot.present = false;
        }
      }
    }
  }
  layout.reserves = (layout.reserves || []).filter((r) => String(r.steamId) !== id);
  for (const block of Object.values(layout.nodes || {})) {
    for (const ns of block.slots || []) {
      if (String(ns.steamId) === id) {
        ns.steamId = null;
        ns.displayName = "";
        ns.slSteamId = null;
        ns.slDisplayName = "";
      }
    }
  }
}

export function clearSlot(layout, kind, refs, opts = {}) {
  const next = deepCloneLayout(layout);
  if (kind === "special") {
    const sp = (next.specials || []).find((s) => s.id === refs.specialId);
    if (sp) {
      sp.steamId = null;
      sp.displayName = "";
      sp.present = false;
    }
  } else if (kind === "slot") {
    for (const sec of next.sectors || []) {
      for (const sq of sec.squads || []) {
        if (sq.id !== refs.squadId) continue;
        const slot = (sq.slots || []).find((s) => s.id === refs.slotId);
        if (slot) {
          slot.steamId = null;
          slot.displayName = "";
          slot.present = false;
        }
      }
    }
  } else if (kind === "reserve") {
    next.reserves = (next.reserves || []).filter(
      (r) => String(r.steamId) !== String(refs.steamId)
    );
  }
  withPostAssignSync(next, opts.confirmedPlayers, opts.rosterSize ?? next.rosterSize);
  return next;
}

export function setPresent(layout, kind, refs, present) {
  const next = deepCloneLayout(layout);
  if (kind === "special") {
    const sp = (next.specials || []).find((s) => s.id === refs.specialId);
    if (sp) sp.present = Boolean(present);
  } else if (kind === "slot") {
    for (const sec of next.sectors || []) {
      for (const sq of sec.squads || []) {
        if (sq.id !== refs.squadId) continue;
        const slot = (sq.slots || []).find((s) => s.id === refs.slotId);
        if (slot) slot.present = Boolean(present);
      }
    }
  } else if (kind === "reserve") {
    const r = (next.reserves || []).find((x) => String(x.steamId) === String(refs.steamId));
    if (r) r.present = Boolean(present);
  }
  return next;
}

export function setStreamers(layout, streamers) {
  const next = deepCloneLayout(layout);
  next.streamers = {
    axis: {
      name: String(streamers?.axis?.name || ""),
      url: String(streamers?.axis?.url || ""),
    },
    allies: {
      name: String(streamers?.allies?.name || ""),
      url: String(streamers?.allies?.url || ""),
    },
  };
  return next;
}

/**
 * Append a default empty squad template to a sector.
 * @returns {{ layout } | { error: string }}
 */
export function addSquadToSector(layout, sectorId, rosterSizeOpt) {
  const next = deepCloneLayout(layout);
  const sec = (next.sectors || []).find((s) => s.id === sectorId);
  if (!sec) return { error: "Sector not found" };

  const template = createSquadTemplate(sectorId, sec.squads || []);
  const rosterSize = Number(rosterSizeOpt) || Number(next.rosterSize) || 0;
  const slotsAfter = countPlayingSlots(next) + (template.slots || []).length;
  if (rosterSize > 0 && slotsAfter > rosterSize) {
    return {
      error: `Adding this squad would exceed LineUp size (${rosterSize})`,
    };
  }

  const type = template.type;
  const allSquads = (next.sectors || []).flatMap((s) => s.squads || []);
  if (type === "armor") {
    const armorN = allSquads.filter((s) => s.type === "armor").length;
    if (armorN >= MAX_ARMOR_SQUADS) {
      return { error: `Max ${MAX_ARMOR_SQUADS} armor squads` };
    }
  }
  if (type === "recon") {
    const reconN = allSquads.filter((s) => s.type === "recon").length;
    if (reconN >= MAX_RECON_SQUADS) {
      return { error: `Max ${MAX_RECON_SQUADS} recon squads` };
    }
  }

  // Probe budget with a temporary push
  sec.squads = [...(sec.squads || []), template];
  if (countSquadBudget(next) > MAX_SQUADS) {
    return { error: `Max ${MAX_SQUADS} squads` };
  }

  return { layout: next };
}

export function roleLabel(role) {
  const map = {
    commander: "Commander",
    artillery: "Artillery",
    streamer: "Streamer",
    sl: "SL",
    rifleman: "Inf",
    mg: "MG",
    tank_commander: "Tank Cmd",
    gunner: "Gunner",
    driver: "Driver",
    spotter: "Spotter",
    sniper: "Sniper",
    engineer: "Engineer",
    support: "Support",
  };
  return map[role] || role || "Slot";
}

/** Font Awesome icon class for a role. */
export function roleIcon(role) {
  const map = {
    commander: "fa-crown",
    artillery: "fa-burst",
    sl: "fa-star",
    spotter: "fa-binoculars",
    support: "fa-box",
    mg: "fa-crosshairs",
    engineer: "fa-wrench",
    rifleman: "fa-person-rifle",
    tank_commander: "fa-shield-halved",
    gunner: "fa-bullseye",
    driver: "fa-truck",
    sniper: "fa-bullseye",
  };
  return map[role] || "fa-user";
}

export function listInfantrySquadOptions(layout) {
  const out = [];
  for (const sec of layout?.sectors || []) {
    for (const sq of sec.squads || []) {
      if (sq.type === "infantry") {
        out.push({
          value: sq.id,
          label: `${sec.label} · ${sq.label}`,
        });
      }
    }
  }
  return out;
}

export const PLAYER_DRAG_MIME = "application/x-tactika-lineup-player";
