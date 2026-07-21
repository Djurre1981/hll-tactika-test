/**
 * Selective Strat icon motion for competitive match planning.
 * Most icons stay static — only high-signal attention / threat markers animate.
 *
 * Motions:
 * - rings   — soft expanding rings (focus / attack point; quieter than ping)
 * - opacity — alpha pulse (danger / kill-zone markers)
 * - scale   — gentle size pulse (demo / AOE threat)
 */

/** @typedef {"rings" | "opacity" | "scale"} AnimatedIconMotion */

/** @type {Readonly<Record<string, AnimatedIconMotion>>} */
export const ANIMATED_ICON_MOTIONS = Object.freeze({
  /** Attack / focus point on the tacmap */
  crosshairs: "rings",
  /** Priority danger / warning */
  "triangle-exclamation": "opacity",
  /** Kill zone / MG / AT threat */
  "skull-crossbones": "opacity",
  /** Demo / satchel / AOE threat */
  bomb: "scale",
});

/**
 * @param {string | null | undefined} iconIdOrName
 * @returns {AnimatedIconMotion | null}
 */
export function animatedIconMotionId(iconIdOrName) {
  if (!iconIdOrName || typeof iconIdOrName !== "string") return null;
  return ANIMATED_ICON_MOTIONS[iconIdOrName] || null;
}
