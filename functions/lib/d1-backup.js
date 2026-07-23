/**
 * Build a portable SQL text dump from the bound D1 database.
 * Suitable for offline backup; not a byte-identical SQLite file.
 */

const ROW_PAGE_SIZE = 500;

export function sqlLiteral(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
    return blobLiteral(new Uint8Array(value));
  }
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) {
    return blobLiteral(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function blobLiteral(bytes) {
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return `X'${hex}'`;
}

export function insertStatement(tableName, columns, row) {
  const values = columns.map((column) => sqlLiteral(row[column]));
  const quotedCols = columns.map((column) => `"${String(column).replace(/"/g, '""')}"`);
  return `INSERT INTO "${String(tableName).replace(/"/g, '""')}" (${quotedCols.join(", ")}) VALUES (${values.join(", ")});`;
}

async function listSchemaObjects(db) {
  const result = await db
    .prepare(
      `SELECT type, name, sql
         FROM sqlite_master
        WHERE sql IS NOT NULL
          AND name NOT LIKE 'sqlite_%'
          AND type IN ('table', 'index', 'trigger', 'view')
        ORDER BY CASE type
          WHEN 'table' THEN 0
          WHEN 'view' THEN 1
          WHEN 'index' THEN 2
          WHEN 'trigger' THEN 3
          ELSE 4
        END,
        name`
    )
    .all();
  return result.results || [];
}

async function dumpTableRows(db, tableName, lines) {
  const safeName = String(tableName).replace(/"/g, '""');
  let offset = 0;
  let columns = null;

  for (;;) {
    const page = await db
      .prepare(`SELECT * FROM "${safeName}" LIMIT ? OFFSET ?`)
      .bind(ROW_PAGE_SIZE, offset)
      .all();
    const rows = page.results || [];
    if (rows.length === 0) {
      break;
    }
    if (!columns) {
      columns = Object.keys(rows[0]);
    }
    for (const row of rows) {
      lines.push(insertStatement(tableName, columns, row));
    }
    if (rows.length < ROW_PAGE_SIZE) {
      break;
    }
    offset += ROW_PAGE_SIZE;
  }
}

/**
 * @param {D1Database} db
 * @param {{ exportedBy?: string, exportedAt?: string }} [meta]
 * @returns {Promise<{ sql: string, tableCount: number, statementCount: number }>}
 */
export async function buildD1SqlDump(db, meta = {}) {
  const exportedAt = meta.exportedAt || new Date().toISOString();
  const objects = await listSchemaObjects(db);
  const tables = objects.filter((row) => row.type === "table");
  const lines = [
    "-- Tactika D1 SQL backup",
    `-- exportedAt: ${exportedAt}`,
    meta.exportedBy ? `-- exportedBy: ${meta.exportedBy}` : null,
    "PRAGMA foreign_keys=OFF;",
    "BEGIN TRANSACTION;",
    "",
  ].filter((line) => line !== null);

  for (const table of tables) {
    if (table.sql) {
      lines.push(`${table.sql};`);
    }
    await dumpTableRows(db, table.name, lines);
    lines.push("");
  }

  for (const object of objects) {
    if (object.type === "table" || !object.sql) {
      continue;
    }
    lines.push(`${object.sql};`);
  }

  lines.push("COMMIT;");
  lines.push("");

  const sql = lines.join("\n");
  return {
    sql,
    tableCount: tables.length,
    statementCount: lines.filter((line) => /^(INSERT|CREATE)\b/i.test(line)).length,
  };
}
