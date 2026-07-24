/** Shared reserve auto-fill helpers (client + API). */

export function collectPlayingSteamIds(layout) {
  const ids = new Set();
  for (const sp of layout?.specials || []) {
    if (sp.role === "streamer") continue;
    if (sp.steamId) ids.add(String(sp.steamId));
  }
  for (const sec of layout?.sectors || []) {
    for (const sq of sec.squads || []) {
      for (const slot of sq.slots || []) {
        if (slot.steamId) ids.add(String(slot.steamId));
      }
    }
  }
  return ids;
}

export function countFilledPlayingSlots(layout) {
  let n = 0;
  for (const sp of layout?.specials || []) {
    if (sp.role === "streamer") continue;
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

/**
 * When playing slots are full (rosterSize), every confirmed RSVP not playing
 * is auto-placed on reserves. Always removes anyone who moved into a playing slot.
 *
 * @param {object} layout — mutated in place
 * @param {Array<{steamId:string, displayName?:string}>} confirmedPlayers
 * @param {number} rosterSize
 */
export function syncReservesWhenFull(layout, confirmedPlayers, rosterSize) {
  const size = Number(rosterSize) || Number(layout?.rosterSize) || 0;
  const playing = collectPlayingSteamIds(layout);
  const confirmed = Array.isArray(confirmedPlayers) ? confirmedPlayers : [];
  const confirmedSet = new Set(confirmed.map((p) => String(p.steamId)));

  const prev = new Map(
    (layout.reserves || []).map((r) => [String(r.steamId), r])
  );

  let reserves = (layout.reserves || []).filter(
    (r) => r?.steamId && !playing.has(String(r.steamId))
  );

  const filled = countFilledPlayingSlots(layout);
  if (size > 0 && filled >= size) {
    for (const p of confirmed) {
      const id = String(p.steamId);
      if (!id || playing.has(id)) continue;
      if (reserves.some((r) => String(r.steamId) === id)) continue;
      const old = prev.get(id);
      reserves.push({
        steamId: id,
        displayName: p.displayName || old?.displayName || "",
        present: Boolean(old?.present),
      });
    }
    reserves = reserves.filter((r) => confirmedSet.has(String(r.steamId)));
  }

  layout.reserves = reserves;
  return layout;
}
