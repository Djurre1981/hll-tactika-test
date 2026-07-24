# Agentx — agent instructions

You are working under the **Agentx** playbook. Follow it unless the user explicitly overrides a step.

## Golden rules

1. **Main is sacred.** Do not commit or push directly to `main`/`master`. Use a branch + PR.
2. **One writer per file.** If parallel work is needed, split ownership first. Never edit files assigned to another agent/session.
3. **Lead foresight before locking tools.** If the stack is unspecified, the work is greenfield, or the feature is sensitive (auth, payments, data) → use the `agentx-lead` skill first. Give options + pros/cons + blind spots; wait for the user’s choice (unless they said “you decide”).
4. **Plan non-trivial work.** If the task touches many files, changes architecture, or is unclear → use the `agentx-plan` skill before coding (after lead decisions when needed).
5. **Verify before “done”.** Run the project’s relevant build/tests (or the checks the user named). If you cannot run them, say so clearly.
6. **Handoff when switching.** Ending a session, pausing, or handing to another agent → use the `agentx-handoff` skill.
7. **Pick the right lane** (isolation):
   - **Local (same checkout)** — default for small/medium single tasks
   - **Worktree** (`/worktree`) — when running 2+ agents locally that must not collide
   - **Cloud agent** — long, risky, or “run while I’m away” tasks that need full isolation
8. **Prefer boring over clever.** Small PRs, clear names, fewer moving parts.
9. **Strictly follow ai-context.md.** Project architecture & conventions

## Default workflow (most tasks)

```
Understand → Lead gate (tools + blind spots) → Plan if needed → Branch → Implement → Verify → Handoff or Ship (PR)
```

## When the user asks for parallel work

Use the `agentx-parallel` skill. Do **not** spawn parallel agents without:

- a written plan with independent tasks
- file/module ownership per task
- one integration owner (usually the planning session / human)

## Skills (invoke when relevant)

| Skill | When |
|-------|------|
| `agentx-lead` | Greenfield, unclear tools, auth/payments/data, or “what should we use?” |
| `agentx-plan` | Non-trivial or multi-step work; anything needing parallel splits |
| `agentx-handoff` | Pause, switch tasks, or pass work to another agent/human |
| `agentx-parallel` | Explicit parallel / fleet / multi-agent requests |
| `agentx-ship` | Ready to open a PR / finish for review |

## Communication style with the user

- Be direct and short; explain jargon in plain English.
- Surface risks early (security defaults, shared files, migrations, lockfile changes, ports).
- For tool choices and blind spots: use **`AskQuestion`** (clickable multiple choice, always include **Other**) and **wait**. For routine implementation details inside an agreed plan: decide and document.
