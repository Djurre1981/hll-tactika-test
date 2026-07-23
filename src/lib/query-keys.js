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
    byId: (id) => ["events", "id", id],
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
    byEvent: (eventId) => ["prep-tasks", "event", eventId],
    mine: (from, to) => ["prep-tasks", "mine", from, to],
  },
};
