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
  folders: {
    all: ["folders"],
  },
  team: {
    roster: ["team", "roster"],
  },
  events: {
    byMonth: (year, month) => ["events", year, month],
    upcoming: (from, to) => ["events", "upcoming", from, to],
  },
  users: {
    me: ["users", "me"],
  },
  whiteboards: {
    all: ["whiteboards"],
    byId: (id) => ["whiteboards", id],
  },
};
