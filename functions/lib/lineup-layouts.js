/**
 * Default LineUp board layouts for roster sizes 18 / 36 / 49.
 * Sector colors match Circle convention. A sector may contain multiple squads.
 *
 * Defaults start with **one squad per sector**; admins add more via +.
 *
 * Squad budget (game): ≤20 squads/team. Commander does NOT count;
 * artillery, recon, and armor DO. Streamers are external (not roster slots).
 *
 * Default infantry roles: SL, Support, MG, Engineer.
 */

export const ROSTER_SIZES = [18, 36, 49];

export const SECTOR_COLORS = {
  command: { key: "command", hex: "#ecf0f1", label: "Command" },
  north: { key: "red", hex: "#c0392b", label: "North / West" },
  meat: { key: "green", hex: "#27ae60", label: "Meat Grind" },
  south: { key: "blue", hex: "#2980b9", label: "South / East" },
  defence: { key: "orange", hex: "#e67e22", label: "Defence" },
  flex: { key: "black", hex: "#111111", label: "Flex" },
  recon: { key: "grey", hex: "#7f8c8d", label: "Recon" },
  tanks: { key: "lightblue", hex: "#5dade2", label: "Tanks" },
};

/** Map infantry sector → preferred nodes HQ block. */
export const SECTOR_TO_NODES = {
  north: "north",
  meat: "middle",
  south: "south",
  defence: "middle",
  flex: "middle",
};

export function sanitizeRosterSize(value) {
  const n = Number(value);
  if (!ROSTER_SIZES.includes(n)) {
    return { error: "rosterSize must be 18, 36, or 49" };
  }
  return { rosterSize: n };
}

function slot(id, role = "rifleman") {
  return {
    id,
    role,
    steamId: null,
    present: false,
    displayName: "",
  };
}

/** Standard infantry: SL, Support, MG, Engineer (optionally truncated). */
function infantrySquad(id, label, roles = ["sl", "support", "mg", "engineer"]) {
  const slots = roles.map((role) =>
    slot(`${id}-${role === "sl" ? "sl" : role}`, role)
  );
  return { id, type: "infantry", label, slots };
}

function armorSquad(id, label, size = 3) {
  if (size >= 3) {
    return {
      id,
      type: "armor",
      label,
      slots: [
        slot(`${id}-tc`, "tank_commander"),
        slot(`${id}-g`, "gunner"),
        slot(`${id}-d`, "driver"),
      ],
    };
  }
  return {
    id,
    type: "armor",
    label,
    slots: [slot(`${id}-g`, "gunner"), slot(`${id}-d`, "driver")],
  };
}

function reconSquad(id, label) {
  return {
    id,
    type: "recon",
    label,
    slots: [slot(`${id}-sl`, "spotter"), slot(`${id}-sn`, "sniper")],
  };
}

function nodeSlot(id, role) {
  return {
    id,
    role,
    steamId: null,
    displayName: "",
    slSteamId: null,
    slDisplayName: "",
  };
}

function emptyNodeBlock(prefix) {
  return {
    slots: [
      nodeSlot(`${prefix}-eng`, "engineer"),
      nodeSlot(`${prefix}-s1`, "support"),
      nodeSlot(`${prefix}-s2`, "support"),
      nodeSlot(`${prefix}-s3`, "support"),
    ],
  };
}

function emptyNodes() {
  return {
    north: emptyNodeBlock("nodes-n"),
    middle: emptyNodeBlock("nodes-m"),
    south: emptyNodeBlock("nodes-s"),
  };
}

function emptyStreamers() {
  return {
    axis: { name: "", url: "" },
    allies: { name: "", url: "" },
  };
}

function sector(id, colorKey, squads) {
  const color = SECTOR_COLORS[colorKey] || SECTOR_COLORS.flex;
  return {
    id,
    label: color.label,
    colorKey: color.key,
    colorHex: color.hex,
    squads,
  };
}

function specials() {
  return [
    {
      id: "special-commander",
      role: "commander",
      countsAsSquad: false,
      steamId: null,
      present: false,
      displayName: "",
    },
    {
      id: "special-arty",
      role: "artillery",
      countsAsSquad: true,
      steamId: null,
      present: false,
      displayName: "",
    },
  ];
}

/** Count Circle playing slots (specials + squads). Streamers excluded. */
export function countPlayingSlots(layout) {
  let n = 0;
  for (const sp of layout?.specials || []) {
    if (sp.role === "streamer") continue;
    n += 1;
  }
  for (const sec of layout?.sectors || []) {
    for (const sq of sec.squads || []) {
      n += (sq.slots || []).length;
    }
  }
  return n;
}

/** Squads that consume the ≤20 game budget. */
export function countSquadBudget(layout) {
  let n = 0;
  for (const sp of layout?.specials || []) {
    if (sp.countsAsSquad) n += 1;
  }
  for (const sec of layout?.sectors || []) {
    n += (sec.squads || []).length;
  }
  return n;
}

/** Default empty squad template for a sector (used by + button). */
export function createSquadTemplate(sectorId, existingSquads = []) {
  const existing = Array.isArray(existingSquads) ? existingSquads : [];
  const ids = new Set(existing.map((s) => String(s.id)));
  const nextIndex = () => {
    let i = existing.length + 1;
    return i;
  };

  const sid = String(sectorId || "");
  if (sid === "tanks") {
    let n = nextIndex();
    while (ids.has(`tank-${n}`)) n += 1;
    return armorSquad(`tank-${n}`, `Tank ${n}`, 3);
  }
  if (sid === "recon") {
    let n = nextIndex();
    while (ids.has(`recon-${n}`)) n += 1;
    return reconSquad(`recon-${n}`, `Recon ${n}`);
  }

  const prefix =
    sid === "defence" ? "def" : sid === "flex" ? "flex" : sid || "squad";
  let n = nextIndex();
  while (ids.has(`${prefix}-${n}`)) n += 1;

  const label =
    sid === "defence"
      ? n === 1
        ? "Defence"
        : `Defence ${n}`
      : sid === "flex"
        ? n === 1
          ? "Flex"
          : `Flex ${n}`
        : sid === "north" || sid === "meat" || sid === "south"
          ? `SL-${n}`
          : `Squad ${n}`;

  return infantrySquad(`${prefix}-${n}`, label);
}

function layout36() {
  // Three tank windows (2B–2D); one squad elsewhere — add more with +
  return {
    rosterSize: 36,
    specials: specials(),
    streamers: emptyStreamers(),
    sectors: [
      sector("tanks", "tanks", [
        armorSquad("tank-1", "Tank 1", 3),
        armorSquad("tank-2", "Tank 2", 3),
        armorSquad("tank-3", "Tank 3", 3),
      ]),
      sector("north", "north", [infantrySquad("north-1", "SL-1")]),
      sector("meat", "meat", [infantrySquad("meat-1", "SL-1")]),
      sector("south", "south", [infantrySquad("south-1", "SL-1")]),
      sector("defence", "defence", [infantrySquad("def-1", "Defence")]),
      sector("recon", "recon", [reconSquad("recon-1", "Recon 1")]),
    ],
    reserves: [],
    nodes: emptyNodes(),
  };
}

function layout49() {
  return {
    rosterSize: 49,
    specials: specials(),
    streamers: emptyStreamers(),
    sectors: [
      sector("tanks", "tanks", [
        armorSquad("tank-1", "Tank 1", 3),
        armorSquad("tank-2", "Tank 2", 3),
        armorSquad("tank-3", "Tank 3", 3),
      ]),
      sector("north", "north", [infantrySquad("north-1", "SL-1")]),
      sector("meat", "meat", [infantrySquad("meat-1", "SL-1")]),
      sector("south", "south", [infantrySquad("south-1", "SL-1")]),
      sector("defence", "defence", [infantrySquad("def-1", "Defence")]),
      sector("flex", "flex", [infantrySquad("flex-1", "Flex")]),
      sector("recon", "recon", [reconSquad("recon-1", "Recon 1")]),
    ],
    reserves: [],
    nodes: emptyNodes(),
  };
}

function layout18() {
  return {
    rosterSize: 18,
    specials: specials(),
    streamers: emptyStreamers(),
    sectors: [
      sector("tanks", "tanks", [armorSquad("tank-1", "Tank 1", 3)]),
      sector("north", "north", [infantrySquad("north-1", "SL-1")]),
      sector("meat", "meat", [infantrySquad("meat-1", "SL-1")]),
      sector("defence", "defence", [
        infantrySquad("def-1", "Defence", ["sl", "support", "mg"]),
      ]),
      sector("recon", "recon", [reconSquad("recon-1", "Recon 1")]),
    ],
    reserves: [],
    nodes: emptyNodes(),
  };
}

const BUILDERS = {
  18: layout18,
  36: layout36,
  49: layout49,
};

/** Build a fresh default layout for the given roster size. */
export function buildDefaultLayout(rosterSize) {
  const sanitized = sanitizeRosterSize(rosterSize);
  if (sanitized.error) {
    throw new Error(sanitized.error);
  }
  const layout = BUILDERS[sanitized.rosterSize]();
  const playing = countPlayingSlots(layout);
  if (playing < 1 || playing > sanitized.rosterSize) {
    throw new Error(
      `Layout ${sanitized.rosterSize} has ${playing} playing slots (expected 1–${sanitized.rosterSize})`
    );
  }
  if (countSquadBudget(layout) > 20) {
    throw new Error(`Layout ${sanitized.rosterSize} exceeds 20 squads`);
  }
  return layout;
}
