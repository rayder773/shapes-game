import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { registerDevControllers } from "./dev";

type Bindings = {
  DB: D1Database;
  APP_ENV?: string;
  ANALYTICS_MAX_BATCH_SIZE?: string;
};

type EventInput = {
  type: string;
  payload: unknown;
  client_created_at: string;
};

type ParsedEvents = {
  events: EventInput[];
  clientId: string | null;
};

type VisitorListRow = {
  id: string;
  ip: string;
  user_agent: string;
  created_at: string;
  events_count: number | string;
};

type EventRow = {
  id: number;
  visitor_id: string;
  type: string;
  payload: string;
  client_created_at: string;
};

type VisitorLookupRow = {
  id: string;
};

const defaultMaxBatchSize = 50;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const app = new Hono<{ Bindings: Bindings }>();
type AppContext = Context<{ Bindings: Bindings }>;

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["content-type"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (context) => {
  return context.json({
    ok: true,
    service: "api",
    env: context.env.APP_ENV ?? "development",
  });
});

registerDevControllers(app);

app.get("/admin/api/visitors", async (context) => {
  const visitors = await context.env.DB.prepare(
    `SELECT visitors.id, visitors.ip, visitors.user_agent, visitors.created_at,
      COUNT(events.id) AS events_count
    FROM visitors
    LEFT JOIN events ON events.visitor_id = visitors.id
    GROUP BY visitors.id
    ORDER BY visitors.created_at DESC`,
  ).all<VisitorListRow>();

  return context.json({
    ok: true,
    visitors: (visitors.results ?? []).map((visitor) => ({
      ...visitor,
      events_count: Number(visitor.events_count),
    })),
  });
});

app.get("/admin/api/visitors/:visitorId/events", async (context) => {
  const visitorId = context.req.param("visitorId");
  const visitor = await context.env.DB.prepare("SELECT id FROM visitors WHERE id = ?")
    .bind(visitorId)
    .first<VisitorLookupRow>();

  if (!visitor) {
    return context.json({ ok: false, error: "visitor_not_found" }, 404);
  }

  const events = await context.env.DB.prepare(
    `SELECT id, visitor_id, type, payload, client_created_at
    FROM events
    WHERE visitor_id = ?
    ORDER BY id DESC`,
  )
    .bind(visitorId)
    .all<EventRow>();

  return context.json({
    ok: true,
    visitor_id: visitorId,
    events: (events.results ?? []).map((event) => ({
      id: event.id,
      visitor_id: event.visitor_id,
      type: event.type,
      payload: parseEventPayload(event.payload),
      client_created_at: event.client_created_at,
    })),
  });
});

app.delete("/admin/api/visitors/:visitorId", async (context) => {
  const visitorId = context.req.param("visitorId");
  const deleted = await deleteVisitorWithEvents(context, visitorId);

  if (!deleted) {
    return context.json({ ok: false, error: "visitor_not_found" }, 404);
  }

  return context.json({ ok: true, deleted_visitor_id: visitorId });
});

app.post("/analytics/events", async (context) => {
  let body: unknown;

  try {
    body = await context.req.json();
  } catch {
    return context.json({ ok: false, error: "invalid_json" }, 400);
  }

  const parsedEvents = parseEvents(body);

  if (!parsedEvents.ok) {
    return context.json({ ok: false, error: parsedEvents.error }, 400);
  }

  const { events, clientId } = parsedEvents.parsed;

  if (events.length > getMaxBatchSize(context.env)) {
    return context.json({ ok: false, error: "batch_too_large" }, 413);
  }

  const visitor = await resolveVisitor(context, clientId);

  if (!visitor.ok) {
    return context.json({ ok: false, error: "invalid_visitor" }, 401);
  }

  const statements = events.map((event) =>
    context.env.DB.prepare(
      "INSERT INTO events (visitor_id, type, payload, client_created_at) VALUES (?, ?, ?, ?)",
    ).bind(visitor.id, event.type, JSON.stringify(event.payload), event.client_created_at),
  );

  await context.env.DB.batch(statements);

  return context.json({
    ok: true,
    visitor_id: visitor.id,
    accepted: events.length,
  });
});

function getMaxBatchSize(env: Bindings): number {
  const maxBatchSize = Number(env.ANALYTICS_MAX_BATCH_SIZE);

  if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1) {
    return defaultMaxBatchSize;
  }

  return maxBatchSize;
}

function parseEvents(
  body: unknown,
): { ok: true; parsed: ParsedEvents } | { ok: false; error: string } {
  const clientId = isRecord(body) && typeof body.client_id === "string"
    ? body.client_id
    : null;
  const events = isRecord(body) && Array.isArray(body.events)
    ? body.events
    : Array.isArray(body)
      ? body
      : [body];

  if (events.length === 0) {
    return { ok: false, error: "empty_batch" };
  }

  const parsedEvents: EventInput[] = [];

  for (const event of events) {
    if (!isRecord(event)) {
      return { ok: false, error: "invalid_event" };
    }

    if (typeof event.type !== "string" || event.type.trim() === "") {
      return { ok: false, error: "invalid_type" };
    }

    if (!("payload" in event)) {
      return { ok: false, error: "missing_payload" };
    }

    if (
      typeof event.client_created_at !== "string" ||
      Number.isNaN(Date.parse(event.client_created_at))
    ) {
      return { ok: false, error: "invalid_client_created_at" };
    }

    parsedEvents.push({
      type: event.type.trim(),
      payload: event.payload,
      client_created_at: event.client_created_at,
    });
  }

  return { ok: true, parsed: { events: parsedEvents, clientId } };
}

async function resolveVisitor(
  context: AppContext,
  clientId: string | null,
): Promise<{ ok: true; id: string } | { ok: false }> {
  if (clientId) {
    if (!uuidPattern.test(clientId)) {
      return { ok: false };
    }

    const visitor = await context.env.DB.prepare(
      "SELECT id FROM visitors WHERE id = ?",
    )
      .bind(clientId)
      .first<{ id: string }>();

    if (visitor) {
      return { ok: true, id: visitor.id };
    }

    await context.env.DB.prepare(
      "INSERT INTO visitors (id, ip, user_agent, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind(
        clientId,
        getRequestIp(context.req.raw),
        context.req.header("user-agent") ?? "",
        new Date().toISOString(),
      )
      .run();

    return { ok: true, id: clientId };
  }

  const newVisitorId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await context.env.DB.prepare(
    "INSERT INTO visitors (id, ip, user_agent, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(
      newVisitorId,
      getRequestIp(context.req.raw),
      context.req.header("user-agent") ?? "",
      createdAt,
    )
    .run();

  return { ok: true, id: newVisitorId };
}

async function deleteVisitorWithEvents(context: AppContext, visitorId: string): Promise<boolean> {
  const visitor = await context.env.DB.prepare("SELECT id FROM visitors WHERE id = ?")
    .bind(visitorId)
    .first<VisitorLookupRow>();

  if (!visitor) {
    return false;
  }

  await context.env.DB.batch([
    context.env.DB.prepare("DELETE FROM events WHERE visitor_id = ?").bind(visitorId),
    context.env.DB.prepare("DELETE FROM visitors WHERE id = ?").bind(visitorId),
  ]);

  return true;
}

function getRequestIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    ""
  );
}

function parseEventPayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default app;
