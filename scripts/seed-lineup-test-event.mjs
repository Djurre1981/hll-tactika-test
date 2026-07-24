/**
 * One-off local seed: HCA FAP match + Discord RSVP lists for LineUp testing.
 * 1) Dump roster (PowerShell): wrangler d1 execute ... > scripts/_roster-dump.json
 * 2) node scripts/seed-lineup-test-event.mjs
 * 3) npm exec wrangler d1 execute hll-tactika-db --local --file scripts/_lineup-seed.sql
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ACCEPTED = [
  "Westscarab (ChromieCollecter)",
  "iirealzzzz",
  "Shezza",
  "Hollzer",
  "Stalin-Haker",
  "Inigo Montoya",
  "winny ツ",
  "Rondris",
  "robo",
  "Toxic Hazard",
  "ŚÁŃĎVÍČĤ™",
  "X.",
  "BaS5",
  "Khazar",
  "RevolutionAgainstVictor",
  "Spin",
  "wix",
  "The M1rO",
  "Devil-may-care",
  "bear",
  "Shepard",
  "Castaño",
  "Sw4nny",
  "Keldon",
  "salty - allahdaboss",
  "a◯",
  "Maxwell",
  "Taro",
  "King Patrick",
  "El Tejón",
  "Hoi, ik ben Martijn.",
  "HeyBalli_EH",
  "killa",
  "ASTARTES",
  "TED",
  "Spin Calls me LOBO",
  "Rab◯l◯k◯",
  "Petard",
  "RicoB5",
  "Jack",
  "Hotglass",
  "Wickedeyedmouse",
  "Carentan Terrorist (IGWT)",
  "Ghost_dragon",
  "VЛиllК • GoLeM (Decha)",
  "Talismanas[LTU]",
  "Tien",
  "[NegA]Smile",
  "timmsy",
  "VapeLord",
  "ErrorDRFT",
  "Guido",
  "legion",
  "Nocalty",
  "Cleo",
];

const TENTATIVE = [
  "ianhaStoned",
  "Kepuli",
  "Inshallah and push",
  "VЛиllК • GoLeM (luigi)",
  "kavis",
];

const DECLINED = [
  "Topo #cosygarlic",
  "ÖöF",
  "Pödre",
  "Millsonius",
  "Grim",
  "SnZ",
  "GreatMeme",
  "Zayn",
  "Proctalgia",
  "WildFagan",
  "Victor78KH1",
  "Hova",
  "Lord.Jax",
];

function normalize(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[◯○●•・]/g, "o")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function matchSteamId(discordName, members) {
  const n = normalize(discordName);
  if (!n) return null;

  let hit = members.find((m) => normalize(m.display_name) === n);
  if (hit) return hit.steam_id;

  hit = members.find((m) => {
    const mn = normalize(m.display_name);
    return (
      mn === n ||
      mn.startsWith(n) ||
      n.startsWith(mn) ||
      (n.length >= 4 && mn.includes(n)) ||
      (mn.length >= 4 && n.includes(mn))
    );
  });
  if (hit) return hit.steam_id;

  const token = n.split(" ")[0];
  if (token.length >= 3) {
    const candidates = members.filter((m) => {
      const parts = normalize(m.display_name).split(" ");
      return parts[0] === token || parts.includes(token);
    });
    if (candidates.length === 1) return candidates[0].steam_id;
  }

  return null;
}

function syntheticSteamId(name, used) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  let id;
  let n = 0;
  do {
    const suffix = String((hash + n * 9973) % 1e10).padStart(10, "0");
    id = `7656119${suffix}`.slice(0, 17);
    n += 1;
  } while (used.has(id));
  used.add(id);
  return id;
}

const dumpRaw = readFileSync(join(root, "scripts/_roster-dump.json"), "utf8").replace(/^\uFEFF/, "");
const dump = JSON.parse(dumpRaw);
const members = (Array.isArray(dump) ? dump[0]?.results : dump?.results) || [];
console.log(`Roster members with Steam ID: ${members.length}`);

const used = new Set(members.map((m) => m.steam_id));
const assignedSteam = new Set();
const resolve = (name) => {
  let matched = matchSteamId(name, members);
  let wasMatched = Boolean(matched);
  if (matched && assignedSteam.has(matched)) {
    matched = null;
    wasMatched = false;
  }
  const steamId = matched || syntheticSteamId(name, used);
  assignedSteam.add(steamId);
  used.add(steamId);
  return { steamId, matched: wasMatched, name };
};

const confirmed = ACCEPTED.map(resolve);
const tentative = TENTATIVE.map(resolve);
const declined = DECLINED.map(resolve);

const matchedCount = [...confirmed, ...tentative, ...declined].filter((r) => r.matched).length;
console.log(
  `Matched ${matchedCount}/${confirmed.length + tentative.length + declined.length} Discord names to roster`
);
const unmatched = [...confirmed, ...tentative, ...declined].filter((r) => !r.matched);
if (unmatched.length) {
  console.log("Unmatched (synthetic Steam IDs):");
  for (const u of unmatched) console.log(`  - ${u.name} → ${u.steamId}`);
}

const eventId = "event-lineup-test-hca-fap-2026-07-26";
const now = new Date().toISOString();
const startsAt = "2026-07-26T18:00:00.000Z";
const endsAt = "2026-07-26T20:00:00.000Z";
const matchJson = JSON.stringify({
  date: "2026-07-26",
  team: "sr",
  faction: "",
  mapId: "",
  startingPoint: "",
  opponent: "HTD & War",
  result: "",
  heloMatchId: "",
  heloUrl: "",
  crconGameId: "",
  crconUrl: "",
  participantSteamIds: [],
});

const lines = [];
lines.push(`DELETE FROM rsvps WHERE event_id = '${esc(eventId)}';`);
lines.push(`DELETE FROM lineups WHERE event_id = '${esc(eventId)}';`);
lines.push(`DELETE FROM events WHERE id = '${esc(eventId)}';`);
lines.push(`INSERT INTO events (
  id, title, description, starts_at, ends_at, event_type, roster_size, signup_target,
  match_json, components_json, locked, lock_override, locked_by, locked_at,
  created_by, created_at, updated_at
) VALUES (
  '${esc(eventId)}',
  '${esc("HCA FAP: The Circle vs HTD & War")}',
  '${esc("Seeded for LineUp testing from Discord Accepted / Tentative / Declined lists.")}',
  '${startsAt}',
  '${endsAt}',
  'comp',
  49,
  49,
  '${esc(matchJson)}',
  '{}',
  0, 0, NULL, NULL,
  'seed-script',
  '${now}',
  '${now}'
);`);

function rsvpRows(list, status) {
  for (const row of list) {
    lines.push(
      `INSERT INTO rsvps (event_id, steam_id, status, reason_code, reason_note, queued_at, updated_at)
       VALUES ('${esc(eventId)}', '${esc(row.steamId)}', '${status}', NULL, '${esc(row.name)}', NULL, '${now}');`
    );
  }
}

rsvpRows(confirmed, "confirmed");
rsvpRows(tentative, "tentative");
rsvpRows(declined, "declined");

const outPath = join(root, "scripts/_lineup-seed.sql");
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`\nWrote ${outPath}`);
console.log(`confirmed=${confirmed.length} tentative=${tentative.length} declined=${declined.length}`);
