/** Map Stratmaker match.faction to routeplanner factionId. */
export function stratFactionToRouteFaction(stratFaction) {
  if (stratFaction === "allies") return "us";
  if (stratFaction === "axis") return "ger";
  return null;
}

export function routeFactionLabel(factionId) {
  if (factionId === "us") return "US";
  if (factionId === "ger") return "GER";
  return factionId || "—";
}

/**
 * Filter route plan list entries for a strat slide (strict map + faction when set).
 */
export function filterRoutePlansForSlide(plans, slideMapId, stratFaction) {
  const routeFaction = stratFactionToRouteFaction(stratFaction);
  return (plans || []).filter((p) => {
    if (p.mapId !== slideMapId) return false;
    if (routeFaction && p.factionId && p.factionId !== routeFaction) return false;
    return true;
  });
}

export function slideRoutePlanMatches(strat, slide, routePlan) {
  if (!slide?.mapId || !routePlan) return false;
  const inner = routePlan.plan && typeof routePlan.plan === "object" ? routePlan.plan : routePlan;
  const mapId = inner.mapId ?? routePlan.mapId;
  const factionId = inner.factionId ?? routePlan.factionId;
  if (mapId !== slide.mapId) return false;
  const expected = stratFactionToRouteFaction(strat?.match?.faction);
  if (expected && factionId && factionId !== expected) return false;
  return true;
}
