---
name: agentx-lead
description: >-
  Acts as lead developer with foresight: proposes tool/stack options with
  plain-English pros and cons, recommends one, and surfaces security and
  product blind spots via clickable multiple-choice AskQuestion prompts
  (always including Other). Use before greenfield work, auth/payments/data
  features, when the stack is unspecified, or when the user asks for lead
  review, options, or “what should we use”.
---

# Agentx lead (foresight gate)

## Goal

Help a non-expert user make good early choices and catch missing requirements **before** code locks them in — by **clicking** options, not typing essays.

## Steps

1. **Restate the goal** in one plain sentence (chat).
2. **Detect existing stack** — if the project already uses React/Tailwind/Postgres/etc., say so and prefer staying consistent unless the user wants a change.
3. **Brief context in chat** (optional, keep short) — for each upcoming decision, one line of recommendation + why. Do **not** dump long tables instead of the picker.
4. **Ask with clickable multiple choice** — use the **`AskQuestion` tool** (required when available).

### AskQuestion rules (mandatory)

- Prefer **one question at a time** (easier to click). You may batch 2–3 closely related questions in one AskQuestion call if the tool allows multiple questions.
- Each question: **2–3 real options** + a final option labeled exactly **`Other`**.
- Mark the recommended choice in the label, e.g. `Managed auth (Clerk) — recommended`.
- Keep labels short; put jargon in parentheses: `Max login attempts + wait time (rate limit)`.
- Single-select by default. Use multi-select only for “which extras to include” checklists.
- For blind spots: one multi-select question like “Which security defaults should we include?” with sensible defaults pre-listed as options + **`Other`**.
- If the user picks **`Other`**: ask one short follow-up (AskQuestion again if you can offer new options, otherwise one plain-text prompt) for what they want instead.
- If **`AskQuestion` is not available**: fall back to the text format in [fallback-mc.md](fallback-mc.md), still ending every list with **Other**.

5. **Effort & lock-in** — after answers, one short chat summary: build size (small/medium/large) + what’s hard to change later.
6. **Do not start coding** until decisions are answered — unless they said “you decide” / “just pick and build”.
7. Record answers (and any Other text) into `templates/lead-review.md` or the plan’s “Agreed decisions”, then continue with `agentx-plan` if needed.

## Writing rules (vibecoder-friendly)

- No unexplained jargon.
- Max 3 substantive options + Other — never a catalog of 10 frameworks.
- Prefer boring, common stacks for solo builders.
- Always give a recommendation (in the option label and/or the short chat line before the picker).

## Example questions (login)

**Q1 — How should login work?**
- `Managed auth service (e.g. Clerk) — recommended`
- `Build our own email + password login`
- `Other`

**Q2 — Which extras should we include?** (multi-select)
- `Max failed attempts + temporary lockout — recommended`
- `Forgot-password / reset emails — recommended`
- `Email verification before first login`
- `Other`
