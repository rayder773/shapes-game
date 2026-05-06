import type { Context, Hono } from "hono";

type Bindings = {
  DB: D1Database;
  APP_ENV?: string;
  ANALYTICS_COOKIE_NAME?: string;
  ANALYTICS_MAX_BATCH_SIZE?: string;
};

type DevContext = Context<{ Bindings: Bindings }>;

type TableRow = {
  name: string;
};

type TableColumn = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
};

export function registerDevRoutes(app: Hono<{ Bindings: Bindings }>): void {
  app.get("/dev/api/tables", async (context) => {
    if (!isDevEnv(context.env)) {
      return context.notFound();
    }

    const tables = await listDatabaseTables(context);
    return context.json({ ok: true, tables: tables.map((table) => table.name) });
  });

  app.get("/dev/api/tables/:table", async (context) => {
    if (!isDevEnv(context.env)) {
      return context.notFound();
    }

    const table = context.req.param("table");

    if (!(await tableExists(context, table))) {
      return context.json({ ok: false, error: "table_not_found" }, 404);
    }

    const limit = parseBoundedInteger(context.req.query("limit"), 100, 1, 500);
    const offset = parseBoundedInteger(context.req.query("offset"), 0, 0, 100_000);
    const tableName = quoteSqlIdentifier(table);
    const columns = await context.env.DB.prepare(`PRAGMA table_info(${tableName})`).all<TableColumn>();
    const rows = await context.env.DB.prepare(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`)
      .bind(limit, offset)
      .all<Record<string, unknown>>();

    return context.json({
      ok: true,
      table,
      limit,
      offset,
      columns: columns.results ?? [],
      rows: rows.results ?? [],
    });
  });
}

function isDevEnv(env: Bindings): boolean {
  return env.APP_ENV === "development";
}

async function listDatabaseTables(context: DevContext): Promise<TableRow[]> {
  const tables = await context.env.DB.prepare(
    `SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name`,
  ).all<TableRow>();

  return tables.results ?? [];
}

async function tableExists(context: DevContext, tableName: string): Promise<boolean> {
  const table = await context.env.DB.prepare(
    `SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name = ?`,
  )
    .bind(tableName)
    .first<TableRow>();

  return table !== null;
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, minimum), maximum);
}

function quoteSqlIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
