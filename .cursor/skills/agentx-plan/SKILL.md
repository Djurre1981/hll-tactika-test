---
name: agentx-plan
description: >-
  Creates an Agentx plan for non-trivial work: goals, independent tasks,
  file ownership, verification, and isolation lane. Use when the user asks
  to plan, before multi-file features, before parallel agents, or when work
  is ambiguous.
---

# Agentx plan

## When to use

- Multi-file or multi-step features
- User says “plan first” / “Agentx plan”
- Before parallel work
- Scope is unclear

## Steps

1. Restate the goal in one sentence.
2. If tools/stack/sensitive defaults are still undecided → run `agentx-lead` first, then continue.
3. Record **agreed decisions** (stack + blind-spot defaults) at the top of the plan.
4. List assumptions and open questions (ask only if blocked).
5. Split into **independent** tasks when possible.
6. For each task, assign **write ownership** (files/folders).
7. Pick isolation lane: local | worktree | cloud.
8. Define **done**: commands to run + acceptance checks (include security defaults the user approved).
9. Write the plan to `docs/agentx/plans/<topic>.md` (create folders if needed), using `templates/plan.md`.
10. Stop and wait for user OK before coding — unless they already said “plan and implement”.

## Output rules

- Prefer fewer tasks with clear ownership over many tiny overlapping ones
- Flag collisions early (same file needed by two tasks)
- Keep the plan short enough to scan in under a minute
- Never leave “we’ll pick a database later” vague inside an implementation plan
