const MG_LABEL_DIRECTION = {
  Carentan: "left",
  Hill400: "left",
  HurtgenV2: "left",
  Mortain: "left",
  ElAlamein: "right",
  Omaha: "right",
  SME: "right",
  Stalingrad: "right",
  Smolensk: "right",
  Tobruk: "right",
  Utah: "right",
  Driel: "bottom",
  Foy: "bottom",
  Remagen: "bottom",
  Elsenborn: "top",
  Juno: "top",
  Kharkov: "top",
  Kursk: "top",
  PHL: "top",
  SMDMV2: "top",
};

export function getMgLabelDirection(mapId) {
  return MG_LABEL_DIRECTION[mapId] || "right";
}

export function getOppositeDirection(dir) {
  switch (dir) {
    case "left": return "right";
    case "right": return "left";
    case "top": return "bottom";
    case "bottom": return "top";
    default: return "right";
  }
}

export function getNeutralDirection(dir) {
  return (dir === "top" || dir === "bottom") ? "bottom" : "right";
}

export const FACTION_DISPLAY = {
  axis: { logo: "assets/logos/axis.svg", label: "Axis" },
  allies: { logo: "assets/logos/allies.svg", label: "Allies" },
  neutral: { logo: "assets/logos/neutral.svg", label: "Neutral" },
};

export function getFactionDisplay(faction) {
  return FACTION_DISPLAY[faction] || FACTION_DISPLAY.neutral;
}

export function getPinTagLabel(tag) {
  return tag === "mg-spot" ? "MG" : "CL";
}
