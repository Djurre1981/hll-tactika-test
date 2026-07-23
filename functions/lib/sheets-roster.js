/**
 * Fetch + parse Circle Google Sheets used to supplement comp rosters.
 * Does NOT grant site access — Steam64 rows only.
 */

export const SHEET_SOURCES = {
  ecl: {
    id: "ecl",
    label: "ECL roster 2026.1",
    rosterName: "ECL Roster",
    url: "https://docs.google.com/spreadsheets/d/1QvnsG-LQmMXoT5BgcfgJKVkdAOL5To5HekJ5Jgk87PQ/export?format=csv",
  },
  comp: {
    id: "comp",
    label: "Circle Comp | Rosters",
    rosterName: "Comp Roster",
    // Recruit / preferred-roles tab
    url: "https://docs.google.com/spreadsheets/d/1GZv4Q-xILC7ry8ESXjN3cqYEimxco6PRwYxgDGywz3Q/export?format=csv&gid=521785014",
  },
};

const STEAM64_RE = /^7656119\d{10}$/;

const COMP_ROLE_HEADER_MAP = [
  { match: /squad\s*lead/i, id: "squad_lead" },
  { match: /\[commander\]/i, id: "commander" },
  { match: /infantry/i, id: "infantry" },
  { match: /\[mg\]/i, id: "mg" },
  { match: /tank/i, id: "tanker" },
  { match: /artillery/i, id: "artillery" },
];

export function splitCsvRow(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvText(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    rows.push({ line: i + 1, cells: splitCsvRow(lines[i]) });
  }
  return { headers, rows };
}

function headerIndex(headers, predicates) {
  for (let i = 0; i < headers.length; i += 1) {
    const h = String(headers[i] || "").trim();
    if (predicates.some((fn) => fn(h))) return i;
  }
  return -1;
}

function normalizeSteamId(raw) {
  const id = String(raw || "").trim();
  return STEAM64_RE.test(id) ? id : null;
}

function isFirstPreference(value) {
  return /^first\s*preference$/i.test(String(value || "").trim());
}

/**
 * @returns {{ rows: object[], skippedInvalid: number }}
 */
export function parseEclSheet(csvText) {
  const { headers, rows } = parseCsvText(csvText);
  const nameIdx = headerIndex(headers, [
    (h) => /^player\s*name$/i.test(h),
    (h) => /^name$/i.test(h),
  ]);
  const steamIdx = headerIndex(headers, [
    (h) => /steam/i.test(h),
    (h) => /64/.test(h),
  ]);
  const mercIdx = headerIndex(headers, [(h) => /merc/i.test(h)]);

  if (nameIdx < 0 || steamIdx < 0) {
    return { error: "ECL sheet missing Player Name / Steam 64 ID columns", rows: [], skippedInvalid: 0 };
  }

  const out = [];
  let skippedInvalid = 0;
  const seen = new Set();

  for (const row of rows) {
    const displayName = String(row.cells[nameIdx] || "").trim().slice(0, 80);
    const steamId = normalizeSteamId(row.cells[steamIdx]);
    if (!steamId) {
      if (displayName || String(row.cells[steamIdx] || "").trim()) skippedInvalid += 1;
      continue;
    }
    if (seen.has(steamId)) continue;
    seen.add(steamId);

    const mercTeam = mercIdx >= 0 ? String(row.cells[mercIdx] || "").trim() : "";
    out.push({
      source: "ecl",
      line: row.line,
      displayName: displayName || `Player ${steamId.slice(-4)}`,
      steamId,
      rosterRoles: ["infantry"],
      situation: mercTeam ? "merc" : "member",
      status: "active",
      tournaments: ["ECL"],
      notes: mercTeam ? `Merc: ${mercTeam}` : "Imported from ECL Sheets",
    });
  }

  return { rows: out, skippedInvalid };
}

/**
 * @returns {{ rows: object[], skippedInvalid: number }}
 */
export function parseCompRecruitSheet(csvText) {
  const { headers, rows } = parseCsvText(csvText);
  const nameIdx = headerIndex(headers, [
    (h) => /discord/i.test(h),
    (h) => /^name$/i.test(h),
  ]);
  const steamIdx = headerIndex(headers, [
    (h) => /steam/i.test(h),
    (h) => /epic/i.test(h),
    (h) => /gamepass/i.test(h),
  ]);
  const threadIdx = headerIndex(headers, [(h) => /recruit\s*thread/i.test(h)]);

  if (nameIdx < 0 || steamIdx < 0) {
    return {
      error: "Comp sheet missing Discord name / Steam ID columns",
      rows: [],
      skippedInvalid: 0,
    };
  }

  const roleColumns = [];
  for (let i = 0; i < headers.length; i += 1) {
    const header = String(headers[i] || "");
    if (!/preferred\s*role/i.test(header)) continue;
    for (const entry of COMP_ROLE_HEADER_MAP) {
      if (entry.match.test(header)) {
        roleColumns.push({ index: i, roleId: entry.id });
        break;
      }
    }
  }

  const out = [];
  let skippedInvalid = 0;
  const seen = new Set();

  for (const row of rows) {
    const displayName = String(row.cells[nameIdx] || "").trim().slice(0, 80);
    const steamId = normalizeSteamId(row.cells[steamIdx]);
    if (!steamId) {
      if (displayName || String(row.cells[steamIdx] || "").trim()) skippedInvalid += 1;
      continue;
    }
    if (seen.has(steamId)) continue;
    seen.add(steamId);

    const roles = [];
    for (const col of roleColumns) {
      if (isFirstPreference(row.cells[col.index]) && !roles.includes(col.roleId)) {
        roles.push(col.roleId);
      }
    }

    const thread = threadIdx >= 0 ? String(row.cells[threadIdx] || "").trim() : "";
    const promoted = /^promoted$/i.test(thread);

    out.push({
      source: "comp",
      line: row.line,
      displayName: displayName || `Player ${steamId.slice(-4)}`,
      steamId,
      rosterRoles: roles.length ? roles : ["infantry"],
      situation: "member",
      status: promoted ? "active" : "trial",
      tournaments: [],
      notes: "Imported from Comp Sheets",
    });
  }

  return { rows: out, skippedInvalid };
}

async function fetchSheetCsv(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/csv,text/plain,*/*",
      "User-Agent": "Mozilla/5.0 (compatible; HLL-Tactika/1.0)",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet (${response.status})`);
  }
  return response.text();
}

/**
 * Fetch both published sheets and return normalized import rows.
 */
export async function fetchSheetImportRows() {
  const [eclText, compText] = await Promise.all([
    fetchSheetCsv(SHEET_SOURCES.ecl.url),
    fetchSheetCsv(SHEET_SOURCES.comp.url),
  ]);

  const ecl = parseEclSheet(eclText);
  if (ecl.error) throw new Error(ecl.error);
  const comp = parseCompRecruitSheet(compText);
  if (comp.error) throw new Error(comp.error);

  return {
    rows: [...ecl.rows, ...comp.rows],
    skippedInvalid: {
      ecl: ecl.skippedInvalid,
      comp: comp.skippedInvalid,
      total: ecl.skippedInvalid + comp.skippedInvalid,
    },
    counts: {
      ecl: ecl.rows.length,
      comp: comp.rows.length,
      total: ecl.rows.length + comp.rows.length,
    },
  };
}

export function isPlaceholderDisplayName(name) {
  return /^Player \d{1,6}$/i.test(String(name || "").trim());
}
