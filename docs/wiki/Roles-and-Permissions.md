# Roles & permissions

Steam allowlist roles control who can use Tactika. Display names appear in Team admin; API slugs are in parentheses.

```
Owner
  └── Comp Admin (admin)
        └── Comp Assist (assist)
              └── Comp Advisor (editor)
                    └── Comp Member (viewer)
```

Not on the allowlist: Steam sign-in may work, but the app returns **forbidden**.

## Comp Member (`viewer`)

| Can | Cannot |
|-----|--------|
| Hub, Calendar, Records, Match Briefs (view) | Create/edit events, strats, or climb pins |
| RSVP / raincheck | Open Management or Team admin |
| Browse/open strats, routes, whiteboards | Climb editor mode |
| View climbing map & pins | |

## Comp Advisor (`editor`)

| Can | Cannot |
|-----|--------|
| Everything Member can | Edit others’ strats or pins |
| Create/edit calendar events; lock/unlock | Management / Team admin |
| Create strats; edit/delete **own** strats | Change site access roles |
| Climb editor: own pins | |
| Routeplanner & Micro Prep; attach tools to events | |
| Create/assign prep tasks | |

## Comp Assist (`assist`)

| Can | Cannot |
|-----|--------|
| Everything Advisor can | Delete others’ strats (Admin+) |
| Edit **any** strat | Management / Team admin |
| Edit **any** climb pin (incl. seed/orphan) | Change site access roles |
| Delete own strats | |

## Comp Admin (`admin`)

| Can | Cannot |
|-----|--------|
| Everything Assist can | Change member roles (Owner only) |
| Management (roster, history, analytics, folders) | Remove other Admins or Owners |
| Comp Roster import/seed | |
| Team panel: add/remove Members, Advisors, Assists | |
| Delete any strat; manage tool locks | |

## Owner (`owner`)

Full control (env bootstrap). Can change roles including Admins; cannot demote/remove themselves.

## Team admin

Owners (and Admins within limits) manage the allowlist under **Admin Panel** (avatar menu → Team).

## Related

- [Troubleshooting](Troubleshooting)
- [Getting started](Getting-Started)
