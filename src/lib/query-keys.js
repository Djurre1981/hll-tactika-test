export const queryKeys = {
  pins: {
    all: ["pins"],
    byMap: (mapId) => ["pins", "map", mapId],
  },
  strats: {
    all: ["strats"],
    byId: (id) => ["strats", id],
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
};
