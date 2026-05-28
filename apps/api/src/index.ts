import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { registerDevControllers } from "./dev";
import {
  createIndexedPublicIdentity,
  createRandomPublicIdentity,
  isKnownPublicIdentity,
  type PlayerPublicIdentity,
} from "./player-public-identity";

type Bindings = {
  DB: D1Database;
  RATE_LIMIT_KV?: KVNamespace;
  APP_ENV?: string;
  ANALYTICS_MAX_BATCH_SIZE?: string;
  ADMIN_API_TOKEN?: string;
  CORS_ALLOWED_ORIGINS?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  RATE_LIMIT_ANALYTICS_MAX?: string;
  RATE_LIMIT_SCORES_MAX?: string;
  RATE_LIMIT_LEADERBOARD_MAX?: string;
  SCORE_ANTI_FRAUD_WINDOW_SECONDS?: string;
  SCORE_ANTI_FRAUD_MAX_DELTA?: string;
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
  public_color_id: string | null;
  public_name_id: string | null;
  best_score: number | null;
  best_score_updated_at?: string | null;
};

type LeaderboardRow = {
  id: string;
  best_score: number;
  public_color_id: string;
  public_name_id: string;
  rank: number;
};

const defaultMaxBatchSize = 50;
const defaultEventsPageSize = 100;
const maxEventsPageSize = 200;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const app = new Hono<{ Bindings: Bindings }>();
type AppContext = Context<{ Bindings: Bindings }>;

app.use(
  "*",
  cors({
    origin: (origin, context) => resolveCorsOrigin(origin, context.env),
    allowHeaders: ["content-type"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  }),
);

app.use("/admin/api/*", async (context, next) => {
  if ((context.env.APP_ENV ?? "development") === "development") {
    await next();
    return;
  }

  const expectedToken = context.env.ADMIN_API_TOKEN?.trim();
  const authorization = context.req.header("authorization")?.trim();

  if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
    return context.json({ ok: false, error: "unauthorized" }, 401);
  }

  await next();
});

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
  const limit = getEventsPageLimit(context.req.query("limit"));
  const beforeId = getEventsBeforeId(context.req.query("before_id"));
  const visitor = await context.env.DB.prepare("SELECT id FROM visitors WHERE id = ?")
    .bind(visitorId)
    .first<VisitorLookupRow>();

  if (!visitor) {
    return context.json({ ok: false, error: "visitor_not_found" }, 404);
  }

  const eventsQuery = beforeId === null
    ? `SELECT id, visitor_id, type, payload, client_created_at
      FROM events
      WHERE visitor_id = ?
      ORDER BY id DESC
      LIMIT ?`
    : `SELECT id, visitor_id, type, payload, client_created_at
      FROM events
      WHERE visitor_id = ? AND id < ?
      ORDER BY id DESC
      LIMIT ?`;
  const events = await context.env.DB.prepare(eventsQuery)
    .bind(...(beforeId === null ? [visitorId, limit + 1] : [visitorId, beforeId, limit + 1]))
    .all<EventRow>();
  const eventRows = events.results ?? [];
  const pageRows = eventRows.slice(0, limit);

  return context.json({
    ok: true,
    visitor_id: visitorId,
    events: pageRows.map((event) => ({
      id: event.id,
      visitor_id: event.visitor_id,
      type: event.type,
      payload: parseEventPayload(event.payload),
      client_created_at: event.client_created_at,
    })),
    next_before_id: eventRows.length > limit ? pageRows.at(-1)?.id ?? null : null,
    has_more: eventRows.length > limit,
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
  const rateLimitResult = await applyRateLimit(
    context,
    "analytics",
    getRateLimitMax(context.env.RATE_LIMIT_ANALYTICS_MAX, 120),
  );

  if (!rateLimitResult.ok) {
    return context.json({ ok: false, error: "rate_limited" }, 429);
  }

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

app.get("/players/me", async (context) => {
  const clientId = context.req.query("client_id") ?? null;
  const visitor = await resolveVisitor(context, clientId);

  if (!visitor.ok) {
    return context.json({ ok: false, error: "invalid_visitor" }, 401);
  }

  const publicIdentity = await ensureVisitorPublicIdentity(context, visitor.id);
  const row = await getVisitor(context, visitor.id);

  return context.json({
    ok: true,
    user_id: visitor.id,
    best_score: row?.best_score ?? 0,
    public_color_id: publicIdentity.publicColorId,
    public_name_id: publicIdentity.publicNameId,
  });
});

app.post("/scores", async (context) => {
  const rateLimitResult = await applyRateLimit(
    context,
    "scores",
    getRateLimitMax(context.env.RATE_LIMIT_SCORES_MAX, 30),
  );

  if (!rateLimitResult.ok) {
    return context.json({ ok: false, error: "rate_limited" }, 429);
  }

  const body = await parseJsonBody(context);

  if (!body.ok) {
    return context.json({ ok: false, error: "invalid_json" }, 400);
  }

  const clientId = isRecord(body.value) && typeof body.value.client_id === "string"
    ? body.value.client_id
    : null;
  const score = isRecord(body.value) ? Number(body.value.score) : Number.NaN;

  if (!Number.isInteger(score) || score < 0) {
    return context.json({ ok: false, error: "invalid_score" }, 400);
  }

  const visitor = await resolveVisitor(context, clientId);

  if (!visitor.ok) {
    return context.json({ ok: false, error: "invalid_visitor" }, 401);
  }

  const publicIdentity = await ensureVisitorPublicIdentity(context, visitor.id);
  const existingVisitor = await getVisitor(context, visitor.id);
  const existingBestScore = existingVisitor?.best_score ?? 0;

  if (isSuspiciousScoreSubmission(score, existingBestScore, existingVisitor?.best_score_updated_at, context.env)) {
    return context.json({ ok: false, error: "suspicious_score" }, 422);
  }

  const bestScore = Math.max(existingBestScore, score);

  if (bestScore !== existingBestScore) {
    await context.env.DB.prepare(
      "UPDATE visitors SET best_score = ?, best_score_updated_at = ? WHERE id = ?",
    )
      .bind(bestScore, new Date().toISOString(), visitor.id)
      .run();
  }

  return context.json({
    ok: true,
    user_id: visitor.id,
    score,
    best_score: bestScore,
    public_color_id: publicIdentity.publicColorId,
    public_name_id: publicIdentity.publicNameId,
  });
});

app.get("/leaderboard", async (context) => {
  const rateLimitResult = await applyRateLimit(
    context,
    "leaderboard",
    getRateLimitMax(context.env.RATE_LIMIT_LEADERBOARD_MAX, 60),
  );

  if (!rateLimitResult.ok) {
    return context.json({ ok: false, error: "rate_limited" }, 429);
  }

  const clientId = context.req.query("client_id") ?? null;
  const limit = getLeaderboardLimit(context.req.query("limit"));
  const around = context.req.query("around") === "current" ? "current" : "top";
  const visitor = clientId ? await resolveVisitor(context, clientId) : { ok: false } as const;
  const currentUserId = visitor.ok ? visitor.id : null;

  if (currentUserId) {
    await ensureVisitorPublicIdentity(context, currentUserId);
  }

  const currentRank = currentUserId ? await getLeaderboardRank(context, currentUserId) : null;
  const offset = around === "current" && currentRank !== null
    ? Math.max(0, currentRank - Math.ceil(limit / 2))
    : 0;
  const rows = await getLeaderboardRows(context, limit, offset);

  return context.json({
    ok: true,
    current_user_id: currentUserId,
    current_rank: currentRank,
    entries: rows.map((row) => ({
      userId: row.id,
      rank: row.rank,
      score: row.best_score,
      publicColorId: row.public_color_id,
      publicNameId: row.public_name_id,
      isCurrentUser: row.id === currentUserId,
    })),
  });
});

function getMaxBatchSize(env: Bindings): number {
  const maxBatchSize = Number(env.ANALYTICS_MAX_BATCH_SIZE);

  if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1) {
    return defaultMaxBatchSize;
  }

  return maxBatchSize;
}

function getEventsPageLimit(value: string | undefined): number {
  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1) {
    return defaultEventsPageSize;
  }

  return Math.min(limit, maxEventsPageSize);
}

function getEventsBeforeId(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const beforeId = Number(value);
  return Number.isInteger(beforeId) && beforeId > 0 ? beforeId : null;
}

function getLeaderboardLimit(value: string | undefined): number {
  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1) {
    return 20;
  }

  return Math.min(limit, 100);
}

function getRateLimitMax(value: string | undefined, fallback: number): number {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function getRateLimitWindowSeconds(env: Bindings): number {
  return getRateLimitMax(env.RATE_LIMIT_WINDOW_SECONDS, 60);
}

function getScoreAntiFraudWindowSeconds(env: Bindings): number {
  return getRateLimitMax(env.SCORE_ANTI_FRAUD_WINDOW_SECONDS, 300);
}

function getScoreAntiFraudMaxDelta(env: Bindings): number {
  return getRateLimitMax(env.SCORE_ANTI_FRAUD_MAX_DELTA, 100);
}

async function applyRateLimit(
  context: AppContext,
  bucket: string,
  maxRequests: number,
): Promise<{ ok: true } | { ok: false }> {
  const kv = context.env.RATE_LIMIT_KV;
  const clientIp = getRequestIp(context.req.raw);

  if (!kv || !clientIp || maxRequests < 1) {
    return { ok: true };
  }

  const windowSeconds = getRateLimitWindowSeconds(context.env);
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSeconds * 1000));
  const key = `rate:${bucket}:${clientIp}:${windowStart}`;
  const currentCount = Number(await kv.get(key) ?? "0");

  if (currentCount >= maxRequests) {
    return { ok: false };
  }

  await kv.put(key, String(currentCount + 1), { expirationTtl: windowSeconds + 5 });
  return { ok: true };
}

function isSuspiciousScoreSubmission
(
  score: number,
  existingBestScore: number,
  bestScoreUpdatedAt: string | null | undefined,
  env: Bindings,
): boolean {
  if (score <= existingBestScore || existingBestScore < 1 || !bestScoreUpdatedAt) {
    return false;
  }

  const previousUpdateTimestamp = Date.parse(bestScoreUpdatedAt);

  if (Number.isNaN(previousUpdateTimestamp)) {
    return false;
  }

  const isWithinFraudWindow =
    Date.now() - previousUpdateTimestamp < getScoreAntiFraudWindowSeconds(env) * 1000;

  return isWithinFraudWindow && score - existingBestScore > getScoreAntiFraudMaxDelta(env);
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

async function getVisitor(context: AppContext, visitorId: string): Promise<VisitorLookupRow | null> {
  return await context.env.DB.prepare(
    "SELECT id, public_color_id, public_name_id, best_score, best_score_updated_at FROM visitors WHERE id = ?",
  )
    .bind(visitorId)
    .first<VisitorLookupRow>();
}

async function ensureVisitorPublicIdentity(
  context: AppContext,
  visitorId: string,
): Promise<PlayerPublicIdentity> {
  const visitor = await getVisitor(context, visitorId);

  if (visitor?.public_color_id && visitor.public_name_id) {
    const publicIdentity = {
      publicColorId: visitor.public_color_id,
      publicNameId: visitor.public_name_id,
    };

    if (isKnownPublicIdentity(publicIdentity)) {
      return publicIdentity;
    }
  }

  const publicIdentity = await findAvailablePublicIdentity(context, visitorId);

  await context.env.DB.prepare(
    `UPDATE visitors
    SET public_color_id = ?, public_name_id = ?, public_identity_assigned_at = COALESCE(public_identity_assigned_at, ?)
    WHERE id = ?`,
  )
    .bind(publicIdentity.publicColorId, publicIdentity.publicNameId, new Date().toISOString(), visitorId)
    .run();

  return publicIdentity;
}

async function findAvailablePublicIdentity(
  context: AppContext,
  visitorId: string,
): Promise<PlayerPublicIdentity> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const candidate = createRandomPublicIdentity();
    const existing = await context.env.DB.prepare(
      `SELECT id FROM visitors
      WHERE public_color_id = ? AND public_name_id = ? AND id <> ?
      LIMIT 1`,
    )
      .bind(candidate.publicColorId, candidate.publicNameId, visitorId)
      .first<{ id: string }>();

    if (!existing) {
      return candidate;
    }
  }

  const row = await context.env.DB.prepare("SELECT COUNT(*) AS count FROM visitors")
    .first<{ count: number }>();

  return createIndexedPublicIdentity(row?.count ?? 0);
}

async function getLeaderboardRank(context: AppContext, visitorId: string): Promise<number | null> {
  const row = await context.env.DB.prepare(
    `WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY best_score DESC, created_at ASC, id ASC) AS rank
      FROM visitors
      WHERE best_score > 0 AND public_color_id IS NOT NULL AND public_name_id IS NOT NULL
    )
    SELECT rank FROM ranked WHERE id = ?`,
  )
    .bind(visitorId)
    .first<{ rank: number }>();

  return row?.rank ?? null;
}

async function getLeaderboardRows(
  context: AppContext,
  limit: number,
  offset: number,
): Promise<LeaderboardRow[]> {
  const rows = await context.env.DB.prepare(
    `WITH ranked AS (
      SELECT
        id,
        best_score,
        public_color_id,
        public_name_id,
        ROW_NUMBER() OVER (ORDER BY best_score DESC, created_at ASC, id ASC) AS rank
      FROM visitors
      WHERE best_score > 0 AND public_color_id IS NOT NULL AND public_name_id IS NOT NULL
    )
    SELECT id, best_score, public_color_id, public_name_id, rank
    FROM ranked
    ORDER BY rank ASC
    LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all<LeaderboardRow>();

  return rows.results ?? [];
}

async function parseJsonBody(
  context: AppContext,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await context.req.json() };
  } catch {
    return { ok: false };
  }
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

function resolveCorsOrigin(origin: string, env: Bindings): string | null {
  if ((env.APP_ENV ?? "development") === "development") {
    return origin || "*";
  }

  const allowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
  return allowedOrigins.has(origin) ? origin : null;
}

function parseAllowedOrigins(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
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
