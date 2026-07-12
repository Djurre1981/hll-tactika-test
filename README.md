# HLL Tactika

Developed by The Circle community and kept strictly exclusive to our competitive team. The platform is a tailored strategy and planning platform for Hell Let Loose designed to scale as our team needs grow. 

Its first release features an interactive climb and MG guide. 

This module came as a solution to MG prep problems. Years of trick videos/spots are scattered across PDFs, local drives and chat threads... Hard to navigate through and therefore rarely used. HLL Tactika puts everything in one place on a map we all understand, making guides easy to access and raising the team's baseline knowledge.

Furthermore, access is fully controlled: Steam sign-in, an approved-member allowlist, and role-based permissions ensure our material stays internal. No more leaked or problems sharing guides with our members.


## Current module features: Interactive Climbing Guide

- All 20 tactical maps with pan/zoom on high-resolution maps
- Grid and strongpoint overlays
- Pin types: **climb** and **MG spot**
- Faction tagging (Axis / Allies / Neutral) and tag filters
- Hover a pin to preview; click to play full video (YouTube, Vimeo, MP4, Medal.tv, Discord attachments)
- Multi-media pins with image/video carousel
- Viewer and Editor modes: place pins on the map, drag, undo/redo
- **Steam sign-in** with role-based allowlist
- **Role-based permissions**: Comp Member, Comp Advisor, Comp Assist, Comp Admin, Owner. See [docs/roles.md](docs/roles.md)
- Protected pin data served only to authenticated, approved users
- Admin panel for member management

## Roadmap

- Fixing any bugs after release.
- Reviewing the requested changes for the current module and implementing them.

After this any future module addition will depend on feedback of members and prep team needs.
There are a lot of ideas (Planning section for rostering etc..?, Our version of stratsketch?, More Guides? Tanks section?..)

## Documentation

- [User & editor guide](docs/user-guide.md) — for members and pin contributors
- [Project overview](docs/project-overview.md)
- [Folder structure](docs/folder-structure.md)
- [Circle roles](docs/roles.md)
- [API reference](docs/api.md)
- [Data schemas & storage](docs/data-schemas.md)

## Quick start

### Production (Cloudflare Pages)

Auth and protected pins require **Cloudflare Pages** with Functions (GitHub Pages alone cannot run the auth API). The Cloudflare project name is **`hll-tactika`** (see [wrangler.toml](wrangler.toml)).

1. Install dependencies: `npm install`
2. Copy `.dev.vars.example` to `.dev.vars` and set:
   - `SESSION_SECRET`: long random string
   - `OWNER_STEAM_IDS`: owners (full control)
   - `ADMIN_STEAM_IDS`: Comp Admins
   - `ASSIST_STEAM_IDS`: Comp Assist (optional)
   - `EDITOR_STEAM_IDS`: Comp Advisor (optional)
   - `VIEWER_STEAM_IDS`: Comp Member (optional; `USER_STEAM_IDS` is a legacy alias)
   - `STEAM_API_KEY` (optional): [Steam Web API key](https://steamcommunity.com/dev/apikey) for display names/avatars
3. Local dev: `npm run dev` → [http://localhost:8788](http://localhost:8788)
4. Deploy: `npm run deploy` (or connect the GitHub repo in the Cloudflare Pages dashboard)

Set the same secrets in Cloudflare: **Pages → your project → Settings → Environment variables**.

### Finding a Steam ID64

After a member signs in once (even if not yet allowlisted), check server logs, or use a site like [steamid.io](https://steamid.io/). Profile URL `https://steamcommunity.com/profiles/76561198…` contains the ID64.

### Legacy static server (no auth)

`python -m http.server 8080` still serves maps/overlays but **will not load tricks** without the auth API.

Open [http://localhost:8080](http://localhost:8080) only for map asset testing.

## Adding pins

Edit `data/pins.json` to add built-in pins per map. Pins are **not** served publicly; they are returned from `/api/pins` after Steam auth.

Use **Add pin** in editor mode to create tricks. Seed pins in `data/pins.json` (with `createdBy: null`) are editable by Comp Assist, Comp Admin, and Owner.

```json
{
  "defaultMapId": "SMDMV2",
  "pins": {
    "SMDMV2": [
      {
        "id": "unique-id",
        "title": "Bush climb, orchard edge",
        "description": "Short explanation of the trick",
        "tag": "climb",
        "faction": "neutral",
        "x": 38.5,
        "y": 52.0,
        "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
        "requires": {},
        "createdBy": null
      }
    ]
  }
}
```

Coordinates are percentages (0-100) so pins stay aligned when zooming. MG spots also need `dirX` and `dirY` for arrow direction. Optional `mediaItems` array supports multiple images and videos per pin.

## Maps & attribution

Tactical map images and spawn/strongpoint data are sourced from the community project [maps-let-loose](https://github.com/mattwright324/maps-let-loose) by mattwright324. Map assets are derived from Hell Let Loose (Team17).

| Map | ID |
|-----|-----|
| Carentan | `Carentan` |
| Driel | `Driel` |
| El Alamein | `ElAlamein` |
| Elsenborn | `Elsenborn` |
| Foy | `Foy` |
| Hill 400 | `Hill400` |
| Hurtgen | `HurtgenV2` |
| Juno Beach | `Juno` |
| Kharkov | `Kharkov` |
| Kursk | `Kursk` |
| Mortain | `Mortain` |
| Omaha Beach | `Omaha` |
| Purple Heart Lane | `PHL` |
| Remagen | `Remagen` |
| Saint Marie du Mont | `SMDMV2` |
| Sainte-Mère-Église | `SME` |
| Stalingrad | `Stalingrad` |
| Smolensk | `Smolensk` |
| Tobruk | `Tobruk` |
| Utah Beach | `Utah` |

Map images live in `maps/no-grid/`. Spawn data is in `data/map-spawns.json` (generated from maps-let-loose `data.js` via `scripts/extract-map-data.py`).

## Controls

| Action | Input |
|--------|-------|
| Pan | Click + drag |
| Zoom | Scroll wheel or +/- buttons |
| Reset view | **Reset view** button |
| Switch map | Sidebar map dropdown |
| Toggle overlays | Sidebar checkboxes |
| Add pin | **Add pin** → click map → fill form |
