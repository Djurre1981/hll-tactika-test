---
name: agentx-handoff
description: >-
  Writes a compressed Agentx handoff document so the next agent or human can
  continue without chat history. Use when pausing, switching tasks, ending a
  session, or transferring work to another agent.
---

# Agentx handoff

## Goal

Replace messy chat export with a **short** handoff that points at real files.

## Steps

1. Summarize status: done / in progress / blocked.
2. List files touched (paths only).
3. Note branch name and PR link if any.
4. Write exact next steps (numbered).
5. Record how to verify (commands).
6. List risks and open questions.
7. Save to `docs/agentx/handoffs/<topic>-YYYYMMDD.md` using `templates/handoff.md`.

## Rules

- Do **not** dump the full conversation
- Do **not** paste large code blocks — link paths instead
- Keep it under ~80 lines when possible

## After writing

Tell the user the handoff path in one line so they can paste it into the next chat:

> Continue from `docs/agentx/handoffs/...`
