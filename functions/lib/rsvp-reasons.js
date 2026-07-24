/** Shared raincheck / absence reason codes (T6b). */

export const RSVP_REASON_CODES = [
  "work",
  "health",
  "schedule_conflict",
  "other_commitment",
  "prefer_not",
  "other",
];

export const RSVP_REASON_LABELS = {
  work: "Work / real life",
  health: "Sick / health",
  schedule_conflict: "Schedule conflict",
  other_commitment: "Other commitment",
  prefer_not: "Prefer not to say",
  other: "Other",
};

export const RSVP_REASON_OPTIONS = RSVP_REASON_CODES.map((code) => ({
  value: code,
  label: RSVP_REASON_LABELS[code],
}));

/**
 * @param {string|null|undefined} reasonCode
 * @param {string|null|undefined} reasonNote
 * @param {{ required?: boolean }} [opts]
 */
export function sanitizeRsvpReason(reasonCode, reasonNote, { required = false } = {}) {
  const code = String(reasonCode || "").trim().toLowerCase();
  const note = String(reasonNote || "").trim().slice(0, 280);

  if (!code) {
    if (required) return { error: "Absence reason is required" };
    return { reasonCode: null, reasonNote: null };
  }

  if (!RSVP_REASON_CODES.includes(code)) {
    return { error: "Invalid absence reason" };
  }

  if (code === "other" && !note) {
    return { error: "Please add a short note for Other" };
  }

  return {
    reasonCode: code,
    reasonNote: note || null,
  };
}

export function defaultSignupTarget(eventType) {
  const type = String(eventType || "").trim().toLowerCase();
  if (type === "scrim" || type === "comp") return 50;
  return null;
}

/** Normalize signup_target from API / DB. */
export function sanitizeSignupTarget(raw) {
  if (raw === null || raw === undefined || raw === "") return { signupTarget: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 200) {
    return { error: "signupTarget must be an integer from 0 to 200, or empty" };
  }
  return { signupTarget: n };
}
