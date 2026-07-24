/** Client helpers for LineUp layout mutations (immutable). */

export function deepCloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout || {}));
}

export function collectAssignedSteamIds(layout) {
  const ids = new Set();
  for (const sp of layout?.specials || []) {
    if (sp.steamId) ids.add(String(sp.steamId));
  }
  for (const sec of layout?.sectors || []) {
    for (const sq of sec.squads || []) {
      for (const slot of sq.slots || []) {
        if (slot.steamId) ids.add(String(slot.steamId));
      }
    }
  }
  for (const r of layout?.reserves || []) {
    if (r.steamId) ids.add(String(r.steamId));
  }
  return ids;
}

export function countFilledPlayingSlots(layout) {
  let n = 0;
  for (const sp of layout?.specials || []) {
    if (sp.steamId) n += 1;
  }
  for (const sec of layout?.sectors || []) {
    for (const sq of sec.squads || []) {
      for (const slot of sq.slots || []) {
        if (slot.steamId) n += 1;
      }
    }
  }
  return n;
}

export function assignToSpecial(layout, specialId, player) {
  const next = deepCloneLayout(layout);
  const sp = (next.specials || []).find((s) => s.id === specialId);
  if (!sp) return { error: "Special slot not found" };
  clearPlayer(next, player.steamId);
  sp.steamId = player.steamId;
  sp.displayName = player.displayName || "";
  sp.present = Boolean(sp.present);
  return { layout: next };
}

export function assignToSlot(layout, squadId, slotId, player) {
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
  return { layout: next };
}

export function assignToReserve(layout, player) {
  const next = deepCloneLayout(layout);
  clearPlayer(next, player.steamId);
  next.reserves = next.reserves || [];
  next.reserves.push({
    steamId: player.steamId,
    displayName: player.displayName || "",
    present: false,
  });
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
      }
    }
  }
}

export function clearSlot(layout, kind, refs) {
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
          const sid = slot.steamId;
          slot.steamId = null;
          slot.displayName = "";
          slot.present = false;
          if (sid) {
            for (const block of Object.values(next.nodes || {})) {
              for (const ns of block.slots || []) {
                if (String(ns.steamId) === String(sid)) {
                  ns.steamId = null;
                  ns.displayName = "";
                }
              }
            }
          }
        }
      }
    }
  } else if (kind === "reserve") {
    next.reserves = (next.reserves || []).filter(
      (r) => String(r.steamId) !== String(refs.steamId)
    );
  }
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

export function assignNodeSlot(layout, blockKey, nodeSlotId, player) {
  const next = deepCloneLayout(layout);
  const block = next.nodes?.[blockKey];
  if (!block) return { error: "Nodes block not found" };
  const ns = (block.slots || []).find((s) => s.id === nodeSlotId);
  if (!ns) return { error: "Node slot not found" };
  for (const b of Object.values(next.nodes || {})) {
    for (const s of b.slots || []) {
      if (String(s.steamId) === String(player.steamId)) {
        s.steamId = null;
        s.displayName = "";
      }
    }
  }
  ns.steamId = player.steamId;
  ns.displayName = player.displayName || "";
  return { layout: next };
}

export function setNodesSl(layout, blockKey, squadId) {
  const next = deepCloneLayout(layout);
  if (!next.nodes?.[blockKey]) return { error: "Nodes block not found" };
  next.nodes[blockKey].slSquadId = squadId || null;
  return { layout: next };
}

export function roleLabel(role) {
  const map = {
    commander: "Commander",
    artillery: "Artillery",
    streamer: "Streamer",
    sl: "SL",
    rifleman: "Rifleman",
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
