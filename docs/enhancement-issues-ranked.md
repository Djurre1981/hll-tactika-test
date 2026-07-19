# Enhancement issues — easiest → hardest

Source: [Djurre1981/hll-tactika-test · label:enhancement](https://github.com/Djurre1981/hll-tactika-test/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement) · 12 issues expanded into 19 implementable ideas · ranked by build effort given current Strat / Microprep / Roster code

| Difficulty | Count |
| ---------- | ----- |
| Easy | 3 |
| Medium | 5 |
| Hard | 5 |
| Very hard | 6 |

## How to read this

Multi-idea tickets (#12, #13) are split into separate rows. Difficulty is relative effort in this codebase — not business priority. Quick wins cluster in Strat UX/docs; the long tail is integrations and engagement platforms.

## Ranked backlog

| # | Difficulty | Issue | Idea | Area | Why this rank |
| -: | --- | --- | --- | --- | --- |
| 1 | Easy | [#6](https://github.com/Djurre1981/hll-tactika-test/issues/6) | Update README for current Strats state | Docs | Docs-only. README already covers Strats/HLL Objects; needs a sync pass for curve tool, radius check, collab notes. |
| 2 | Easy | [#4](https://github.com/Djurre1981/hll-tactika-test/issues/4) | Merge line + arrow into one tool | Strat | Lines already support endType (none/start/end/both). Mostly toolbar UX: drop separate Arrow, default ends when needed. |
| 3 | Easy | [#7](https://github.com/Djurre1981/hll-tactika-test/issues/7) | Review icons for animation | Strat | Audit pass + selective motion. Ping animation path already exists; most icons stay static. Scope is review + a few candidates. |
| 4 | Medium | [#5](https://github.com/Djurre1981/hll-tactika-test/issues/5) | Link roster matches ↔ strats + “match strats” folder | Strat / Roster | Strat already has match metadata. Needs bidirectional IDs, UI pickers on roster + strat, and a folder convention/seed. |
| 5 | Medium | [#11](https://github.com/Djurre1981/hll-tactika-test/issues/11) | Link roster matches ↔ microprep (whiteboard/slideshow) | Microprep / Roster | Same pattern as #5 against whiteboards API. Reuse linking UX once #5 exists; still touches two domains. |
| 6 | Medium | [#9](https://github.com/Djurre1981/hll-tactika-test/issues/9) | Insert HLL map images into whiteboard / slideshow | Microprep | Excalidraw already supports images. Wire map asset picker → insert. Less kernel work than Strat image insert. |
| 7 | Medium | [#3](https://github.com/Djurre1981/hll-tactika-test/issues/3) | Insert image into Strat builder | Strat | New object type in map-kernel: schema, hit-test, handles, draw, upload/URL, collab sync. Heavier than Excalidraw image insert. |
| 8 | Medium | [#8](https://github.com/Djurre1981/hll-tactika-test/issues/8) | Maps Let Loose–style visibility layer | Strat | Overlay + mask logic over the tacmap (fog / sector visibility). Clear reference product, but non-trivial canvas + UX. |
| 9 | Hard | [#10](https://github.com/Djurre1981/hll-tactika-test/issues/10) | Unify whiteboard + slideshow (convert-to-slideshow) | Microprep | Architecture decision + migration. Modes already share Excalidraw; merging UX/storage and converting boards is a product redesign. |
| 10 | Hard | [#2](https://github.com/Djurre1981/hll-tactika-test/issues/2) | Rich text / markdown in Strat text tool | Strat | Canvas text today is plain. Bold/lists/fonts need layout, editing UI, and serialization — classic hard drawing-tool problem. |
| 11 | Hard | [#12](https://github.com/Djurre1981/hll-tactika-test/issues/12) | HLLRecords links on roster + Tactika profile | Integrations | External profile URLs + roster/profile UI. Medium alone, but depends on stable player identity mapping. |
| 12 | Hard | [#12](https://github.com/Djurre1981/hll-tactika-test/issues/12) | Live Circle RCON server stats (map / rotation) | Integrations | Needs a trusted RCON/stats bridge (Worker poll or webhook), secrets, and a live UI surface. Ops + backend, not just frontend. |
| 13 | Hard | [#13](https://github.com/Djurre1981/hll-tactika-test/issues/13) | Pin ratings (effectiveness / difficulty) | Engagement | New rating model, APIs, aggregation, and climb-guide UI. Contained domain, but full product feature. |
| 14 | Hard | [#13](https://github.com/Djurre1981/hll-tactika-test/issues/13) | Contribution XP + tiers + player of the month | Engagement | XP rules, titles, leaderboards/feeds. Touches pins, users, and home/social surfaces. |
| 15 | Very hard | [#12](https://github.com/Djurre1981/hll-tactika-test/issues/12) | Match signups / rainchecks / cancellations in Tactika | Integrations | New attendance domain: states, permissions, roster coupling, calendar UX. Large product slice. |
| 16 | Very hard | [#12](https://github.com/Djurre1981/hll-tactika-test/issues/12) | Notifications + admin custom alerts | Integrations | Delivery channels (in-app / email / Discord), preferences, triggers, and role-gated send. Platform work. |
| 17 | Very hard | [#12](https://github.com/Djurre1981/hll-tactika-test/issues/12) | Post-match stats / RCON data analysis | Integrations | Ingest, store, and visualize match telemetry. Schema + pipelines + analysis UI. |
| 18 | Very hard | [#12](https://github.com/Djurre1981/hll-tactika-test/issues/12) | RCON admin actions inside Tactika (map flips, etc.) | Integrations | Privileged remote control of game servers. AuthZ, audit logs, safety, and “is this even allowed?” risk. Hardest. |
| 19 | Very hard | [#12](https://github.com/Djurre1981/hll-tactika-test/issues/12) | Message system / inbox | Integrations | Full messaging product: threads, unread, permissions, realtime. Large independent system. |

## By parent issue

### Strat

#6 README · #4 line/arrow merge · #7 icon animation review · #5 match link · #3 images · #8 visibility · #2 rich text

### Microprep

#9 map images · #11 match link · #10 whiteboard/slideshow unify

### Engagement (#13)

Ratings first, then XP/tiers/player-of-month feed

### Integrations (#12)

Profile links → live stats → signups → notifications → match analytics → RCON admin → inbox

## Suggested first slice

Ship ranks 1–4 as one Strat polish PR: README sync, merge line/arrow, icon animation audit, then match↔strat linking.

That sequence stays inside existing map-kernel / roster surfaces and unlocks #11 with the same linking pattern.
