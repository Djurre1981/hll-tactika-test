---
name: agentx-ship
description: >-
  Ships Agentx work via branch and pull request with summary, test plan, and
  risk notes. Use when the user asks to open a PR, ship, finish for review, or
  merge-ready the current work.
---

# Agentx ship

## Steps

1. Confirm branch is not `main`/`master`.
2. Ensure changes are committed (only if user asked to commit; otherwise prepare the PR content and ask).
3. Run verify checks again if not freshly green.
4. Push branch (when user wants remote PR).
5. Open PR with body from `templates/pr-body.md`:
   - Summary (why)
   - What changed
   - Test plan checklist
   - Risks / follow-ups
6. Return the PR URL.

## PR title style

Short, imperative, focused on why:

- `Add checkout retry for flaky payment webhook`
- `Fix empty state on orders list`

## Do not

- Force-push to main
- Merge unless the user explicitly asks
- Hide lockfile / migration / env changes — call them out
