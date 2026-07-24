/**
 * Default LineUp board layouts for roster sizes 18 / 36 / 49.
 * Sector colors match Circle convention. A sector may contain multiple squads.
 *
 * Squad budget (game): ≤20 squads/team. Commander and streamer do NOT count;
 * artillery, recon, and armor DO.
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

function infantrySquad(id, label, size) {
  const slots = [slot(`${id}-sl`, "sl")];
  for (let i = 1; i < size; i += 1) {
    slots.push(slot(`${id}-p${i}`, "rifleman"));
  }
  return { id, type: "infantry", label, slots };
}

function armorSquad(id, label, size) {
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

function emptyNodeBlock(prefix) {
  return {
    slSquadId: null,
    slots: [
      { id: `${prefix}-eng`, role: "engineer", steamId: null, displayName: "" },
      { id: `${prefix}-s1`, role: "support", steamId: null, displayName: "" },
      { id: `${prefix}-s2`, role: "support", steamId: null, displayName: "" },
      { id: `${prefix}-s3`, role: "support", steamId: null, displayName: "" },
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

function specials({ streamer = true } = {}) {
  const list = [
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
  if (streamer) {
    list.push({
      id: "special-streamer",
      role: "streamer",
      countsAsSquad: false,
      steamId: null,
      present: false,
      displayName: "",
    });
  }
  return list;
}

/** Count playing slots (specials + all squad slots). Nodes/reserves excluded. */
export function countPlayingSlots(layout) {
  let n = (layout.specials || []).length;
  for (const sec of layout.sectors || []) {
    for (const sq of sec.squads || []) {
      n += (sq.slots || []).length;
    }
  }
  return n;
}

/** Squads that consume the ≤20 game budget. */
export function countSquadBudget(layout) {
  let n = 0;
  for (const sp of layout.specials || []) {
    if (sp.countsAsSquad) n += 1;
  }
  for (const sec of layout.sectors || []) {
    n += (sec.squads || []).length;
  }
  return n;
}

function layout36() {
  return {
    rosterSize: 36,
    specials: specials({ streamer: true }),
    sectors: [
      sector("tanks", "tanks", [
        armorSquad("tank-1", "Tank 1", 3),
        armorSquad("tank-2", "Tank 2", 3),
        armorSquad("tank-flex", "Flex Tank", 2),
      ]),
      sector("north", "north", [
        infantrySquad("north-1", "SL-1", 2),
        infantrySquad("north-2", "SL-2", 2),
        infantrySquad("north-3", "SL-3", 2),
      ]),
      sector("meat", "meat", [
        infantrySquad("meat-1", "SL-1", 2),
        infantrySquad("meat-2", "SL-2", 2),
        infantrySquad("meat-3", "SL-3", 2),
      ]),
      sector("south", "south", [
        infantrySquad("south-1", "SL-1", 2),
        infantrySquad("south-2", "SL-2", 2),
        infantrySquad("south-3", "SL-3", 2),
      ]),
      sector("defence", "defence", [
        infantrySquad("def-1", "SL-1", 1),
        infantrySquad("def-2", "SL-2", 1),
        infantrySquad("def-3", "SL-3", 1),
      ]),
      sector("flex", "flex", [infantrySquad("flex-1", "Flex MG", 2)]),
      sector("recon", "recon", [reconSquad("recon-1", "Recon 1")]),
    ],
    reserves: [],
    nodes: emptyNodes(),
  };
}

function layout49() {
  return {
    rosterSize: 49,
    specials: specials({ streamer: true }),
    sectors: [
      sector("tanks", "tanks", [
        armorSquad("tank-1", "Tank 1", 3),
        armorSquad("tank-2", "Tank 2", 3),
        armorSquad("tank-3", "Tank 3", 3),
      ]),
      sector("north", "north", [
        infantrySquad("north-1", "SL-1", 3),
        infantrySquad("north-2", "SL-2", 3),
        infantrySquad("north-3", "SL-3", 3),
      ]),
      sector("meat", "meat", [
        infantrySquad("meat-1", "SL-1", 3),
        infantrySquad("meat-2", "SL-2", 3),
        infantrySquad("meat-3", "SL-3", 3),
      ]),
      sector("south", "south", [
        infantrySquad("south-1", "SL-1", 3),
        infantrySquad("south-2", "SL-2", 3),
        infantrySquad("south-3", "SL-3", 3),
      ]),
      sector("defence", "defence", [
        infantrySquad("def-1", "SL-1", 1),
        infantrySquad("def-2", "SL-2", 1),
        infantrySquad("def-3", "SL-3", 1),
      ]),
      sector("flex", "flex", [infantrySquad("flex-1", "Flex", 3)]),
      sector("recon", "recon", [
        reconSquad("recon-1", "Recon 1"),
        reconSquad("recon-2", "Recon 2"),
      ]),
    ],
    reserves: [],
    nodes: emptyNodes(),
  };
}

function layout18() {
  return {
    rosterSize: 18,
    specials: specials({ streamer: false }),
    sectors: [
      sector("tanks", "tanks", [armorSquad("tank-1", "Tank 1", 3)]),
      sector("meat", "meat", [infantrySquad("meat-1", "Meat Grind", 6)]),
      sector("north", "north", [infantrySquad("north-1", "North / West", 3)]),
      sector("defence", "defence", [infantrySquad("def-1", "Defence", 2)]),
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
  if (playing !== sanitized.rosterSize) {
    throw new Error(
      `Layout ${sanitized.rosterSize} has ${playing} playing slots (expected ${sanitized.rosterSize})`
    );
  }
  if (countSquadBudget(layout) > 20) {
    throw new Error(`Layout ${sanitized.rosterSize} exceeds 20 squads`);
  }
  return layout;
}
