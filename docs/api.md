# API Reference

JSON REST API via **Cloudflare Pages Functions** under `/api/`. Errors: `{ "error": "<message>" }`.

Auth: HttpOnly cookie `hll-tactika-session` (7-day TTL), set after Steam OpenID. Browser clients must use `credentials: "include"`.

---

## Routes

| Method | Path | Auth | Returns / notes |
|--------|------|------|-----------------|
| `GET` | `/api/auth/steam` | — | `302` → Steam OpenID |
| `GET` | `/api/auth/callback` | — | `302` → `/` + cookie if allowlisted; `/?auth=forbidden&steamId=…` if not; `/?auth=error` on failure |
| `GET` | `/api/auth/me` | optional cookie | See [Auth status](#auth-status) below |
| `POST` | `/api/auth/logout` | — | `200` `{ ok: true }`, clears cookie |
| `GET` | `/api/pins` | allowlisted | `200` `{ defaultMapId, pins: { [mapId]: Pin[] } }` — see [data-schemas.md](data-schemas.md) |
| `POST` | `/api/pins` | `editor`+ | `201` `{ pin, mapId }` — body: `{ mapId, pin }` |
| `PUT` | `/api/pins/:pinId` | `editor`+ | `200` `{ pin, mapId }` — body: `{ mapId, pin: { …fields } }` (partial update) |
| `DELETE` | `/api/pins/:pinId?mapId=` | `editor`+ | `200` `{ ok, mapId, pinId }` |
| `GET` | `/api/admin/users` | `admin`+ | `200` `{ users: [{ steamId, name, role, removable, roleEditable }] }` |
| `POST` | `/api/admin/users` | `admin`+ | `201` `{ user }` — body: `{ steamId }` (17-digit ID64) |
| `DELETE` | `/api/admin/users/:steamId` | `admin`+ | `200` `{ ok, steamId }` |
| `PATCH` | `/api/admin/users/:steamId` | `owner` | `200` `{ user }` — body: `{ role }` (`viewer`/`editor`/`assist`/`admin`) |
| `GET` | `/api/medal/resolve?url=` | allowlisted | `200` `{ contentId, title, contentUrl, thumbnailUrl, shareUrl }` |

Role capabilities: [roles.md](roles.md). Pin field shapes: [data-schemas.md](data-schemas.md).

---

## Auth status

`GET /api/auth/me`:

| Status | Body |
|--------|------|
| `200` | `{ authenticated: true, steamId, name, avatar, role }` — role: `owner` \| `admin` \| `assist` \| `editor` \| `viewer` |
| `401` | `{ authenticated: false }` — no valid session |
| `403` | `{ authenticated: false, forbidden: true }` — signed in but not allowlisted |

---

## Pins

Stored in Cloudflare KV — see [data-schemas.md](data-schemas.md). `/data/pins.json` returns `404`; use `GET /api/pins`.

- **POST** — `createdBy` / `createdByName` set server-side. `pin.id` optional (auto `pin-<uuid>`).
- **PUT** — only sent fields updated; non-`mg-spot` tag strips `dirX`/`dirY`.
- **DELETE** — `mapId` query param required.
- **Permissions** — `editor` can only mutate own pins; `assist`/`admin`/`owner` can mutate any pin.

Common errors: `400` validation, `403` role/ownership, `404` pin not found, `503` KV unavailable.

---

## Admin

Member list in KV key `users` — see [data-schemas.md](data-schemas.md). New members default to `viewer`. Owners assign roles via `PATCH`; owners themselves come from `OWNER_STEAM_IDS` env only.

---

## Medal.tv

`url` query must be a `medal.tv` link. Resolves to direct CDN URL for in-app playback. Cached `private, max-age=300`. Errors: `400` bad URL, `404` clip not found, `502` upstream failure.

---

## Public static data

Not under `/api/` — no auth required:

- `GET /data/map-spawns.json` — map list, strongpoint geometry
- `GET /data/strongpoint-names.json` — sector label positions

Details: [data-schemas.md](data-schemas.md).
