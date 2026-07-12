# Circle roles

This app uses Steam sign-in and an allowlist stored in Cloudflare KV (plus environment variables for bootstrap). Each approved Steam account is assigned one of the roles below.

Internal slugs (used in API responses and KV storage) are shown in parentheses. Display names appear in the admin panel UI.

## No access

Steam accounts **not** on the allowlist can sign in with Steam but are denied access to the app. They see the forbidden screen and cannot load map pin data.

Ask a **Comp Admin** or **Owner** to add your Steam ID64 to the member list.

---

## Comp Member (`viewer`)

Read-only access to the interactive map.

| Can | Cannot |
|-----|--------|
| View all maps, overlays, and pins | Open the admin panel |
| Pan, zoom, filter, and play trick videos | Switch to editor mode |
| Use viewer mode features | Add, edit, delete, or drag pins |

---

## Comp Advisor (`editor`)

Contributors who manage their own trick pins.

| Can | Cannot |
|-----|--------|
| Everything Comp Member can do | Open the admin panel |
| Enter editor mode | Edit pins created by others |
| Add new pins | Edit built-in seed pins (`createdBy: null`) |
| Edit, delete, and drag **their own** pins | Change member roles or remove members |

---

## Comp Assist (`assist`)

Trusted editors who can curate any trick on the map.

| Can | Cannot |
|-----|--------|
| Everything Comp Advisor can do | Open the admin panel |
| Edit, delete, and drag **any** pin (including seed pins) | Change member roles or remove members |
| Add new pins | |

---

## Comp Admin (`admin`)

Circle administrators who manage membership.

| Can | Cannot |
|-----|--------|
| Everything Comp Assist can do | Remove other Comp Admins or Owners |
| Open the admin panel | Change member roles (owner only) |
| Add new members (default: Comp Member) | Demote themselves |
| Remove Comp Member, Comp Advisor, and Comp Assist users | Create new Owners |

---

## Owner (`owner`)

Full control except self-demotion and creating additional owners via the UI.

| Can | Cannot |
|-----|--------|
| Everything Comp Admin can do | Remove or demote themselves |
| Change roles between Comp Member, Comp Advisor, Comp Assist, and Comp Admin | Change another Owner's role |
| Remove Comp Admins (including env-defined admins via revoke) | Create new Owners in the admin panel |

Owners are assigned via the `OWNER_STEAM_IDS` environment variable or stored in KV during migration.

---

## Role hierarchy

```
Owner
  └── Comp Admin
        └── Comp Assist
              └── Comp Advisor
                    └── Comp Member
```

Higher roles inherit the capabilities of lower roles (with admin-panel access only for Comp Admin and Owner).

## Configuration

| Environment variable | Default role |
|---------------------|--------------|
| `OWNER_STEAM_IDS` | Owner |
| `ADMIN_STEAM_IDS` | Comp Admin |
| `ASSIST_STEAM_IDS` | Comp Assist |
| `EDITOR_STEAM_IDS` | Comp Advisor |
| `VIEWER_STEAM_IDS` | Comp Member |
| `USER_STEAM_IDS` | Comp Member (legacy alias for `VIEWER_STEAM_IDS`) |

Members added through the admin panel are created as **Comp Member** unless an Owner changes their role.

## Technical notes

- **Editor mode** (the Viewer / Editor app mode switch) is available to Comp Advisor, Comp Assist, Comp Admin, and Owner — not Comp Member.
- Pin mutations (`POST` / `PUT` / `DELETE` on `/api/pins`) are enforced on the server; UI restrictions alone are not sufficient.
- Legacy KV entries with `role: "user"` are migrated to `viewer` on load.
