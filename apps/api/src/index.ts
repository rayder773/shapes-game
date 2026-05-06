import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

type Bindings = {
  DB: D1Database;
  APP_ENV?: string;
  ANALYTICS_COOKIE_NAME?: string;
  ANALYTICS_MAX_BATCH_SIZE?: string;
};

type EventInput = {
  type: string;
  payload: unknown;
  client_created_at: string;
};

const defaultVisitorCookieName = "sg_visitor_id";
const defaultMaxBatchSize = 50;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const app = new Hono<{ Bindings: Bindings }>();
type AppContext = Context<{ Bindings: Bindings }>;

app.get("/health", (context) => {
  return context.json({
    ok: true,
    service: "api",
    env: context.env.APP_ENV ?? "development",
  });
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

  const events = parsedEvents.events;

  if (events.length > getMaxBatchSize(context.env)) {
    return context.json({ ok: false, error: "batch_too_large" }, 413);
  }

  const visitor = await resolveVisitor(context);

  if (!visitor.ok) {
    clearVisitorCookie(context);
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

function getVisitorCookieName(env: Bindings): string {
  return env.ANALYTICS_COOKIE_NAME?.trim() || defaultVisitorCookieName;
}

function getMaxBatchSize(env: Bindings): number {
  const maxBatchSize = Number(env.ANALYTICS_MAX_BATCH_SIZE);

  if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1) {
    return defaultMaxBatchSize;
  }

  return maxBatchSize;
}

function parseEvents(
  body: unknown,
): { ok: true; events: EventInput[] } | { ok: false; error: string } {
  const events = Array.isArray(body) ? body : [body];

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

  return { ok: true, events: parsedEvents };
}

async function resolveVisitor(
  context: AppContext,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const visitorId = getCookie(context, getVisitorCookieName(context.env));

  if (visitorId) {
    if (!uuidPattern.test(visitorId)) {
      return { ok: false };
    }

    const visitor = await context.env.DB.prepare(
      "SELECT id FROM visitors WHERE id = ?",
    )
      .bind(visitorId)
      .first<{ id: string }>();

    if (!visitor) {
      return { ok: false };
    }

    return { ok: true, id: visitor.id };
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

  setVisitorCookie(context, newVisitorId);

  return { ok: true, id: newVisitorId };
}

function setVisitorCookie(context: AppContext, visitorId: string): void {
  setCookie(context, getVisitorCookieName(context.env), visitorId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "Lax",
    secure: new URL(context.req.url).protocol === "https:",
  });
}

function clearVisitorCookie(context: AppContext): void {
  deleteCookie(context, getVisitorCookieName(context.env), {
    path: "/",
  });
}

function getRequestIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    ""
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default app;
