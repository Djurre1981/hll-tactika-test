export const queryKeys = {
  pins: {
    all: ["pins"],
    byMap: (mapId) => ["pins", "map", mapId],
  },
  strats: {
    all: ["strats"],
    byId: (id) => ["strats", id],
    byFolder: (folderId) => ["strats", "folder", folderId || "all"],
    meta: ["strats", "meta"],
  },
  roster: {
    all: ["roster"],
  },
  rosters: {
    root: ["rosters"],
    all: ["rosters", "list"],
    members: (rosterId) => ["rosters", rosterId, "members"],
    fairness: (rosterId) => ["rosters", rosterId, "fairness"],
  },
  folders: {
    all: ["folders"],
  },
  team: {
    roster: ["team", "roster"],
  },
  events: {
    byMonth: (year, month) => ["events", year, month],
    upcoming: (from, to) => ["events", "upcoming", from, to],
    history: (from, to) => ["events", "history", from, to],
    byId: (id) => ["events", "id", id],
  },
  lineups: {
    byId: (id) => ["lineups", id],
  },
  users: {
    me: ["users", "me"],
  },
  presence: {
    members: ["presence", "members"],
  },
  whiteboards: {
    all: ["whiteboards"],
    byId: (id) => ["whiteboards", id],
  },
  routePlans: {
    all: ["route-plans"],
    byId: (id) => ["route-plans", id],
  },
  prepTasks: {
    mineRoot: ["prep-tasks", "mine"],
    openRoot: ["prep-tasks", "open"],
    byEvent: (eventId) => ["prep-tasks", "event", eventId],
    mine: (from, to) => ["prep-tasks", "mine", from, to],
    open: (from, to) => ["prep-tasks", "open", from, to],
  },
  rsvps: {
    root: ["rsvps"],
    byEvent: (eventId) => ["rsvps", "event", eventId],
  },
  playerStats: {
    root: ["player-stats"],
    byEvent: (eventId) => ["player-stats", "event", eventId],
    aggregates: (steamIdsKey) => ["player-stats", "aggregates", steamIdsKey],
  },
};
