import type { Hono } from "hono";

type Bindings = {
  DB: D1Database;
  APP_ENV?: string;
  ANALYTICS_MAX_BATCH_SIZE?: string;
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

export function registerDevControllers(app: Hono<{ Bindings: Bindings }>): void {
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

  app.delete("/dev/api/visitors/:visitorId", async (context) => {
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

    await context.env.DB.batch([
      context.env.DB.prepare("DELETE FROM events WHERE visitor_id = ?").bind(visitorId),
      context.env.DB.prepare("DELETE FROM visitors WHERE id = ?").bind(visitorId),
    ]);

    return context.json({ ok: true, deleted_visitor_id: visitorId });
  });
}

function isDevEnv(env: Bindings): boolean {
  return env.APP_ENV === "development";
}

function parseEventPayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}
