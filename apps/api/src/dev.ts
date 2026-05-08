import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

type Bindings = {
  DB: D1Database;
  APP_ENV?: string;
  ANALYTICS_COOKIE_NAME?: string;
  ANALYTICS_MAX_BATCH_SIZE?: string;
};

type DevContext = Context<{ Bindings: Bindings }>;

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

const defaultVisitorCookieName = "sg_visitor_id";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function registerDevControllers(app: Hono<{ Bindings: Bindings }>): void {
  app.get("/dev/api/client", async (context) => {
    if (!isDevEnv(context.env)) {
      return context.notFound();
    }

    const cookieValue = getCookie(context, getVisitorCookieName(context.env)) ?? null;
    const status = await resolveClientCookieStatus(context, cookieValue);

    return context.json({
      ok: true,
      cookie_name: getVisitorCookieName(context.env),
      cookie_value: cookieValue,
      status,
    });
  });

  app.post("/dev/api/client/fresh", (context) => {
    if (!isDevEnv(context.env)) {
      return context.notFound();
    }

    clearVisitorCookie(context);
    return context.json({ ok: true, status: "none" });
  });

  app.post("/dev/api/client/invalid", (context) => {
    if (!isDevEnv(context.env)) {
      return context.notFound();
    }

    setVisitorCookie(context, "invalid-cookie");
    return context.json({ ok: true, status: "invalid_format", cookie_value: "invalid-cookie" });
  });

  app.get("/dev/api/visitors", async (context) => {
    if (!isDevEnv(context.env)) {
      return context.notFound();
    }

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

  app.get("/dev/api/visitors/:visitorId/events", async (context) => {
    if (!isDevEnv(context.env)) {
      return context.notFound();
    }

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

  app.post("/dev/api/client/visitor/:visitorId", async (context) => {
    if (!isDevEnv(context.env)) {
      return context.notFound();
    }

    const visitorId = context.req.param("visitorId");
    const visitor = await context.env.DB.prepare("SELECT id FROM visitors WHERE id = ?")
      .bind(visitorId)
      .first<VisitorLookupRow>();

    if (!visitor) {
      return context.json({ ok: false, error: "visitor_not_found" }, 404);
    }

    setVisitorCookie(context, visitor.id);

    return context.json({
      ok: true,
      status: "known_visitor",
      cookie_value: visitor.id,
      visitor_id: visitor.id,
    });
  });

  app.delete("/dev/api/visitors/:visitorId", async (context) => {
    if (!isDevEnv(context.env)) {
      return context.notFound();
    }

    const visitorId = context.req.param("visitorId");
    const result = await context.env.DB.prepare("DELETE FROM visitors WHERE id = ?")
      .bind(visitorId)
      .run();

    if ((result.meta.changes ?? 0) < 1) {
      return context.json({ ok: false, error: "visitor_not_found" }, 404);
    }

    const currentCookieValue = getCookie(context, getVisitorCookieName(context.env));
    if (currentCookieValue === visitorId) {
      clearVisitorCookie(context);
    }

    return context.json({ ok: true, deleted_visitor_id: visitorId });
  });
}

function isDevEnv(env: Bindings): boolean {
  return env.APP_ENV === "development";
}

function getVisitorCookieName(env: Bindings): string {
  return env.ANALYTICS_COOKIE_NAME?.trim() || defaultVisitorCookieName;
}

function setVisitorCookie(context: DevContext, visitorId: string): void {
  setCookie(context, getVisitorCookieName(context.env), visitorId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "Lax",
    secure: new URL(context.req.url).protocol === "https:",
  });
}

function clearVisitorCookie(context: DevContext): void {
  deleteCookie(context, getVisitorCookieName(context.env), {
    path: "/",
  });
}

async function resolveClientCookieStatus(
  context: DevContext,
  cookieValue: string | null,
): Promise<"none" | "known_visitor" | "unknown_visitor" | "invalid_format"> {
  if (!cookieValue) {
    return "none";
  }

  if (!uuidPattern.test(cookieValue)) {
    return "invalid_format";
  }

  const visitor = await context.env.DB.prepare("SELECT id FROM visitors WHERE id = ?")
    .bind(cookieValue)
    .first<VisitorLookupRow>();

  return visitor ? "known_visitor" : "unknown_visitor";
}

function parseEventPayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}
