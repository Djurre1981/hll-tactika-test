# HLL Tactika — User & Editor Guide

Developed by The Circle community and kept strictly exclusive to our competitive team. **HLL Tactika** is a tailored strategy and planning platform for Hell Let Loose, designed to scale as our team needs grow.

Its first release is an **interactive climb and MG guide** a single place for bush climbs, roof access, MG positions, and more, laid out on the tactical maps we all already use. Years of trick videos and spots used to be scattered across PDFs, local drives, and chat threads. This puts everything on one map, easy to find, so we can raise the team's baseline knowledge.

Access is controlled: Steam sign-in, an approved-member allowlist, and role-based permissions keep our material internal.

---

## Getting started

1. Open the site and sign in with **Steam**.
2. If you are on the member allowlist, you land on the map viewer after the welcome screen.
3. If you are **not** on the allowlist yet, you will see a forbidden screen.


Your role decides what you can do. In short:

| Role | What you can do on the map |
|------|----------------------------|
| **Comp Member** | View maps, filters, and trick videos — read only |
| **Comp Advisor** | Everything above, plus add and edit **your own** pins in editor mode |
| **Comp Assist** | Edit **any** pin, including built-in seed pins |
| **Comp Admin / Owner** | Member management (admin panel) plus full edit access |

---

## Using the map (everyone)

### Navigation

| Action | How |
|--------|-----|
| Pan | Click and drag the map |
| Zoom | Scroll wheel, or use the **+** / **−** buttons |
| Reset view | **Reset view** button |
| Switch map | Map dropdown in the sidebar |
| Toggle overlays | Grid and strongpoint checkboxes in the sidebar |

### Finding tricks

- **Hover** a pin for a quick preview (thumbnail and title).
- **Click** a pin to open the full detail view — description, requirements, and video or image carousel.
- Use the **sidebar pin list** to jump to a trick; clicking a row focuses that pin on the map.
- **Filter by tag** — show only climbs or only MG spots.
- **Filter by faction** — Axis, Allies, or Neutral (mainly affects MG spot arrows; see colours below).
- **Search** — matches pin **title**, **tag**, and **position code** only (description text is not searchable).

## Pin colours — read the map at a glance

We rely on everyone adding pins in a **clean, consistent way**. Colours tell you the pin type, faction, and whether something still needs work.

```
Yellow     →  Spot marked, but no video/images yet — Requires fixing
Green pin  →  Climb trick with media attached
Red arrow  →  Axis MG spot with media
Blue arrow →  Allies MG spot with media
Dark arrow →  Neutral MG spot with media
```

A healthy map should be mostly **green** and **red/blue/dark arrows**, with **yellow** only for work-in-progress spots we are actively filling in.

---

### Tips for clean pins

- **Always add media** — no yellow pins left behind unless you are actively working on them.
- **Clear titles** — say what the trick is in a few words (e.g. "Orchard bush climb, west hedge").
- **Short descriptions** — how to do it, what to watch for.
- **Correct faction** on MG spots so Axis and Allies see the right colour.
- **One trick per pin** — if a spot has two unrelated climbs, split them.
- **Stable video URLs** — YouTube and Medal.tv links age well. Discord attachment links work too: on save the site copies them to cloud storage automatically so they do not expire after ~24 hours.

---

### Adding a climb pin

1. Switch to **Editor** mode.
2. Click **Add pin** in the sidebar.
3. Choose tag **climb** and set faction if relevant.
4. **Click the map** where the trick is — you can drag the pin to fine-tune.
5. Fill in **title**, **description**, and at least one **video or image** (so the pin turns green, not yellow).
6. Optionally tick requirements: truck, repair station, barricade, or faction-specific deployable.
7. Save.

### Adding an MG spot

MG spots need **two clicks** on the map:

1. **First click** — arrowhead (where the gunner looks / fires).
2. **Second click** — bar base (where the MG sits).

You can then **drag** the arrowhead and bar to adjust. Keep them far enough apart — if they collapse on top of each other, the app will ask you to separate them.

Set the correct **faction** (Axis / Allies / Neutral) so the arrow shows the right colour. Add a video showing the setup and line of fire.

### Supported video links

YouTube, Vimeo, direct `.mp4` / `.webm` files, Discord attachment links, and Medal.tv clips all work. **Discord attachments** are archived to the app’s cloud storage when you save the pin (you can paste the CDN link as usual). Prefer YouTube or Medal.tv when you already have a stable public link.

---

### Editing and deleting

- **Right-click** a pin (or use the context menu) to edit or delete — only if your role allows it.
- **Comp Advisor** — your own pins only.
- **Comp Assist and above** — any pin, including old seed pins shipped with the app.

### Undo and redo

While adjusting pin position in the map, use **Ctrl+W** to undo and **Ctrl+Y** to redo.

## Admin panel (Comp Admin and Owner)

Open the admin panel from the user menu to add or remove members. New members start as **Comp Member**. Only **Owners** can change someone’s role (Advisor, Assist, Admin).

If you need access or a role change, contact a Comp Admin or Owner on Discord.

---

## Need help?

- **Can’t sign in / forbidden screen** — you are not on the allowlist yet.
- **Pin won’t save** — check title and position; MG spots need both arrowhead and bar separated.
- **Video won’t play** — try a different host (YouTube, Medal.tv, or direct MP4).

For role details, see [roles.md](roles.md). For technical setup and deployment, see the main [README](../README.md).
