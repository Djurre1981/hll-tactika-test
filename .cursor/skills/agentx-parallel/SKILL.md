---
name: agentx-parallel
description: >-
  Runs Agentx parallel/fleet workflow: plan independent tasks, assign file
  ownership, choose worktrees or cloud, and keep one integrator. Use when the
  user asks for parallel agents, multiple sessions, fleet mode, or concurrent
  workstreams.
---

# Agentx parallel

## Hard rules

- **No parallel without a plan** (use `agentx-plan` first)
- Tasks must be **independent** (no shared write files)
- One **integrator** (human or one orchestrator chat) merges results
- Prefer **2–3** parallel lanes max for solo/small teams

## Steps

1. Run / refresh the plan with ownership table.
2. If any file is claimed by two tasks → re-split or serialize those tasks.
3. Choose isolation:
   - Local parallel → `/worktree` per task (or separate branches)
   - Long/risky tasks → cloud agent per task → PRs
4. Start one agent/session per task with:
   - link to the plan
   - its ownership list
   - “do not edit outside ownership”
   - verify commands
5. Integrator waits for green checks, then merges via PRs (skill `agentx-ship`).
6. Write a handoff if stopping mid-fleet (`agentx-handoff`).

## Do not

- Let two agents edit the same checkout without worktrees
- Auto-merge to `main`
- Parallelize tightly coupled refactors (do those sequentially)
