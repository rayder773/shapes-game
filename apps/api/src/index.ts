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
import {
  consumeRateLimit,
  createOrMergeGoogleUser,
  deleteAccount,
  resolveSession,
  revokeSession,
  verifyGoogleCredential,
} from "./auth";
import {
  DEFAULT_GAME_SETTINGS,
  parseGameSettingsConfig,
  readGameSettings,
  readHistoryConfig,
  writeGameSettings,
} from "./game-settings";

type Bindings = {
  DB: D1Database;
  APP_ENV?: string;
  ANALYTICS_MAX_BATCH_SIZE?: string;
  GOOGLE_CLIENT_ID?: string;
  SESSION_TOKEN_PEPPER?: string;
  RATE_LIMIT_SALT?: string;
};

type EventInput = {
  type: string;
  payload: unknown;
  client_created_at: string;
  visitor_id?: string;
  analytics_session_id?: string;
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
  last_event_at: string | null;
  events_count: number | string;
  identity_type: "anonymous" | "google";
  display_name: string | null;
  avatar_url: string | null;
  best_score: number;
  linked_visitors_count: number | string;
};

type EventRow = {
  id: number;
  visitor_id: string;
  type: string;
  payload: string;
  client_created_at: string;
  actor_type: "anonymous" | "authenticated";
  actor_user_id: string | null;
  analytics_session_id: string | null;
};

type VisitorLookupRow = {
  id: string;
  public_color_id: string | null;
  public_name_id: string | null;
  best_score: number | null;
};

type LeaderboardRow = {
  id: string;
  best_score: number;
  identity_type: "anonymous" | "authenticated";
  public_color_id: string | null;
  public_name_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  rank: number;
};

const defaultMaxBatchSize = 50;
const defaultEventsPageSize = 100;
const maxEventsPageSize = 200;
const maxBestScore = 1_000_000;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const app = new Hono<{ Bindings: Bindings }>();
type AppContext = Context<{ Bindings: Bindings }>;

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["content-type", "authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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

app.post("/auth/google", async (context) => {
  const allowed = await consumeRateLimit(
    context.env,
    "google_sign_in",
    getRequestIp(context.req.raw),
    10,
    10 * 60,
  );
  if (!allowed) return context.json({ ok: false, error: "rate_limited" }, 429);

  const body = await parseJsonBody(context);
  if (!body.ok || !isRecord(body.value)) {
    return context.json({ ok: false, error: "invalid_json" }, 400);
  }
  const credential = typeof body.value.credential === "string" ? body.value.credential : "";
  const clientId = typeof body.value.client_id === "string" ? body.value.client_id : null;
  const localBestScore = typeof body.value.local_best_score === "number" ? body.value.local_best_score : 0;
  if (!Number.isInteger(localBestScore) || localBestScore < 0 || localBestScore > maxBestScore) {
    return context.json({ ok: false, error: "invalid_score" }, 400);
  }
  const visitor = await resolveVisitor(context, clientId);
  if (!visitor.ok) return context.json({ ok: false, error: "invalid_visitor" }, 401);
  const claims = await verifyGoogleCredential(credential, context.env.GOOGLE_CLIENT_ID);
  if (!claims) return context.json({ ok: false, error: "invalid_google_credential" }, 401);
  const result = await createOrMergeGoogleUser(context.env, claims, visitor.id, localBestScore);
  return context.json({
    ok: true,
    token: result.token,
    session_id: result.session.sessionId,
    user: serializeUser(result.session),
  });
});

app.get("/auth/me", async (context) => {
  const session = await resolveSession(context.env, context.req.header("authorization"));
  if (!session) return context.json({ ok: false, error: "invalid_session" }, 401);
  return context.json({ ok: true, session_id: session.sessionId, user: serializeUser(session) });
});

app.post("/auth/logout", async (context) => {
  await revokeSession(context.env, context.req.header("authorization"));
  return context.json({ ok: true });
});

app.delete("/account", async (context) => {
  const session = await resolveSession(context.env, context.req.header("authorization"), false);
  if (!session) return context.json({ ok: false, error: "invalid_session" }, 401);
  await deleteAccount(context.env, session);
  return context.json({ ok: true });
});

app.get("/game-settings", async (context) => {
  const settings = await readGameSettings(context.env.DB);
  return context.json({
    ok: true,
    version: settings.version,
    config: settings.config,
    updated_at: settings.updatedAt,
  });
});

app.get("/admin/api/me", async (context) => {
  const auth = await getAdminAuth(context);
  if (!auth.ok) return context.json({ ok: false, error: auth.error }, auth.status);
  return context.json({
    ok: true,
    admin: { id: auth.session.userId, email: auth.session.email, display_name: auth.session.displayName },
  });
});

app.get("/admin/api/game-settings", async (context) => {
  const auth = await getAdminAuth(context);
  if (!auth.ok) return context.json({ ok: false, error: auth.error }, auth.status);
  const settings = await readGameSettings(context.env.DB);
  return context.json({
    ok: true,
    current: serializeGameSettings(settings),
    defaults: DEFAULT_GAME_SETTINGS,
  });
});

app.put("/admin/api/game-settings", async (context) => {
  const auth = await getAdminAuth(context);
  if (!auth.ok) return context.json({ ok: false, error: auth.error }, auth.status);
  const body = await parseJsonBody(context);
  if (!body.ok || !isRecord(body.value)) return context.json({ ok: false, error: "invalid_json" }, 400);
  const expectedVersion = readPositiveInteger(body.value.expected_version);
  const config = parseGameSettingsConfig(body.value.config);
  if (expectedVersion === null || !config) return context.json({ ok: false, error: "invalid_settings" }, 400);
  const saved = await writeGameSettings(context.env.DB, auth.session, config, expectedVersion, "update");
  if (!saved) return context.json({ ok: false, error: "version_conflict" }, 409);
  return context.json({ ok: true, current: serializeGameSettings(saved) });
});

app.post("/admin/api/game-settings/defaults", async (context) => {
  const auth = await getAdminAuth(context);
  if (!auth.ok) return context.json({ ok: false, error: auth.error }, auth.status);
  const body = await parseJsonBody(context);
  const expectedVersion = body.ok && isRecord(body.value) ? readPositiveInteger(body.value.expected_version) : null;
  if (expectedVersion === null) return context.json({ ok: false, error: "invalid_version" }, 400);
  const saved = await writeGameSettings(
    context.env.DB, auth.session, DEFAULT_GAME_SETTINGS, expectedVersion, "defaults",
  );
  if (!saved) return context.json({ ok: false, error: "version_conflict" }, 409);
  return context.json({ ok: true, current: serializeGameSettings(saved) });
});

app.get("/admin/api/game-settings/history", async (context) => {
  const auth = await getAdminAuth(context);
  if (!auth.ok) return context.json({ ok: false, error: auth.error }, auth.status);
  const beforeVersion = readPositiveInteger(context.req.query("before_version"));
  const query = beforeVersion === null
    ? `SELECT version, config, operation, created_at, actor_email, restored_from_version
       FROM game_settings_history ORDER BY version DESC LIMIT 51`
    : `SELECT version, config, operation, created_at, actor_email, restored_from_version
       FROM game_settings_history WHERE version < ? ORDER BY version DESC LIMIT 51`;
  const rows = beforeVersion === null
    ? await context.env.DB.prepare(query).all<GameSettingsHistoryRow>()
    : await context.env.DB.prepare(query).bind(beforeVersion).all<GameSettingsHistoryRow>();
  const results = rows.results ?? [];
  const page = results.slice(0, 50);
  return context.json({
    ok: true,
    history: page.map((row) => ({ ...row, config: JSON.parse(row.config) })),
    next_before_version: results.length > 50 ? page.at(-1)?.version ?? null : null,
    has_more: results.length > 50,
  });
});

app.post("/admin/api/game-settings/restore", async (context) => {
  const auth = await getAdminAuth(context);
  if (!auth.ok) return context.json({ ok: false, error: auth.error }, auth.status);
  const body = await parseJsonBody(context);
  if (!body.ok || !isRecord(body.value)) return context.json({ ok: false, error: "invalid_json" }, 400);
  const expectedVersion = readPositiveInteger(body.value.expected_version);
  const sourceVersion = readPositiveInteger(body.value.source_version);
  if (expectedVersion === null || sourceVersion === null) return context.json({ ok: false, error: "invalid_version" }, 400);
  const config = await readHistoryConfig(context.env.DB, sourceVersion);
  if (!config) return context.json({ ok: false, error: "history_not_found" }, 404);
  const saved = await writeGameSettings(
    context.env.DB, auth.session, config, expectedVersion, "restore", sourceVersion,
  );
  if (!saved) return context.json({ ok: false, error: "version_conflict" }, 409);
  return context.json({ ok: true, current: serializeGameSettings(saved) });
});

app.get("/admin/api/visitors", async (context) => {
  const auth = await getAdminAuth(context);
  if (!auth.ok) return context.json({ ok: false, error: auth.error }, auth.status);
  const visitors = await context.env.DB.prepare(
    `SELECT visitors.id, visitors.ip, visitors.user_agent, visitors.created_at,
      MAX(events.client_created_at) AS last_event_at,
      COUNT(events.id) AS events_count, 'anonymous' AS identity_type,
      NULL AS display_name, NULL AS avatar_url, visitors.best_score,
      1 AS linked_visitors_count
    FROM visitors
    LEFT JOIN events ON events.visitor_id = visitors.id
    WHERE visitors.user_id IS NULL
    GROUP BY visitors.id
    UNION ALL
    SELECT 'user:' || users.id AS id, '' AS ip, '' AS user_agent, users.created_at,
      MAX(events.client_created_at) AS last_event_at, COUNT(DISTINCT events.id) AS events_count,
      'google' AS identity_type, users.display_name, users.avatar_url, users.best_score,
      COUNT(DISTINCT visitors.id) AS linked_visitors_count
    FROM users
    LEFT JOIN visitors ON visitors.user_id = users.id
    LEFT JOIN events ON events.visitor_id = visitors.id
    GROUP BY users.id
    ORDER BY last_event_at DESC, created_at DESC`,
  ).all<VisitorListRow>();

  return context.json({
    ok: true,
    visitors: (visitors.results ?? []).map((visitor) => ({
      ...visitor,
      events_count: Number(visitor.events_count),
      linked_visitors_count: Number(visitor.linked_visitors_count),
    })),
  });
});

app.get("/admin/api/visitors/:visitorId/events", async (context) => {
  const auth = await getAdminAuth(context);
  if (!auth.ok) return context.json({ ok: false, error: auth.error }, auth.status);
  const visitorId = context.req.param("visitorId");
  const limit = getEventsPageLimit(context.req.query("limit"));
  const beforeId = getEventsBeforeId(context.req.query("before_id"));
  const isUser = visitorId.startsWith("user:");
  const entityId = isUser ? visitorId.slice(5) : visitorId;
  const visitor = isUser
    ? await context.env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(entityId).first<{ id: string }>()
    : await context.env.DB.prepare("SELECT id FROM visitors WHERE id = ?").bind(entityId).first<VisitorLookupRow>();

  if (!visitor) {
    return context.json({ ok: false, error: "visitor_not_found" }, 404);
  }

  const subjectClause = isUser
    ? "visitor_id IN (SELECT id FROM visitors WHERE user_id = ?)"
    : "visitor_id = ?";
  const eventsQuery = beforeId === null
    ? `SELECT id, visitor_id, type, payload, client_created_at, actor_type, actor_user_id, analytics_session_id
      FROM events
      WHERE ${subjectClause}
      ORDER BY id DESC
      LIMIT ?`
    : `SELECT id, visitor_id, type, payload, client_created_at, actor_type, actor_user_id, analytics_session_id
      FROM events
      WHERE ${subjectClause} AND id < ?
      ORDER BY id DESC
      LIMIT ?`;
  const events = await context.env.DB.prepare(eventsQuery)
    .bind(...(beforeId === null ? [entityId, limit + 1] : [entityId, beforeId, limit + 1]))
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
      actor_type: event.actor_type,
      actor_user_id: event.actor_user_id,
      analytics_session_id: event.analytics_session_id,
    })),
    next_before_id: eventRows.length > limit ? pageRows.at(-1)?.id ?? null : null,
    has_more: eventRows.length > limit,
  });
});

app.delete("/admin/api/visitors/:visitorId", async (context) => {
  const auth = await getAdminAuth(context);
  if (!auth.ok) return context.json({ ok: false, error: auth.error }, auth.status);
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

  const statements = [];
  for (const event of events) {
    const eventVisitorId = event.visitor_id && uuidPattern.test(event.visitor_id)
      ? event.visitor_id
      : visitor.id;
    const resolvedEventVisitor = eventVisitorId === visitor.id
      ? visitor
      : await resolveVisitor(context, eventVisitorId);
    if (!resolvedEventVisitor.ok) continue;
    const actor = event.analytics_session_id
      ? await context.env.DB.prepare(
        "SELECT user_id FROM sessions WHERE id = ?",
      ).bind(event.analytics_session_id).first<{ user_id: string }>()
      : null;
    statements.push(context.env.DB.prepare(
      `INSERT INTO events
       (visitor_id, type, payload, client_created_at, actor_type, actor_user_id, analytics_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      resolvedEventVisitor.id,
      event.type,
      JSON.stringify(event.payload),
      event.client_created_at,
      actor ? "authenticated" : "anonymous",
      actor?.user_id ?? null,
      event.analytics_session_id ?? null,
    ));
  }

  await context.env.DB.batch(statements);

  return context.json({
    ok: true,
    visitor_id: visitor.id,
    accepted: statements.length,
  });
});

app.get("/players/me", async (context) => {
  const authorization = context.req.header("authorization");
  const session = await resolveSession(context.env, authorization);
  if (authorization && !session) return context.json({ ok: false, error: "invalid_session" }, 401);
  if (session) {
    return context.json({
      ok: true,
      user_id: session.userId,
      best_score: session.bestScore,
      identity: { type: "authenticated", displayName: session.displayName, avatarUrl: session.avatarUrl },
    });
  }
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
    identity: { type: "anonymous", publicColorId: publicIdentity.publicColorId, publicNameId: publicIdentity.publicNameId },
  });
});

app.post("/scores", async (context) => {
  const body = await parseJsonBody(context);

  if (!body.ok) {
    return context.json({ ok: false, error: "invalid_json" }, 400);
  }

  const clientId = isRecord(body.value) && typeof body.value.client_id === "string"
    ? body.value.client_id
    : null;
  const score = isRecord(body.value) && typeof body.value.score === "number"
    ? body.value.score
    : Number.NaN;

  if (!Number.isInteger(score) || score < 0 || score > maxBestScore) {
    return context.json({ ok: false, error: "invalid_score" }, 400);
  }

  const authorization = context.req.header("authorization");
  const session = await resolveSession(context.env, authorization);
  if (authorization && !session) return context.json({ ok: false, error: "invalid_session" }, 401);

  const visitor = await resolveVisitor(context, clientId);

  if (!visitor.ok) {
    return context.json({ ok: false, error: "invalid_visitor" }, 401);
  }

  const rateSubject = session ? `user:${session.userId}` : `visitor:${visitor.id}`;
  if (!await consumeRateLimit(context.env, "score", rateSubject, 30, 60)) {
    return context.json({ ok: false, error: "rate_limited" }, 429);
  }

  if (session) {
    const bestScore = Math.max(session.bestScore, score);
    if (bestScore !== session.bestScore) {
      await context.env.DB.prepare(
        "UPDATE users SET best_score = ?, best_score_updated_at = ? WHERE id = ?",
      ).bind(bestScore, new Date().toISOString(), session.userId).run();
    }
    await context.env.DB.prepare("UPDATE visitors SET user_id = ? WHERE id = ?")
      .bind(session.userId, visitor.id).run();
    return context.json({
      ok: true, user_id: session.userId, score, best_score: bestScore,
      identity: { type: "authenticated", displayName: session.displayName, avatarUrl: session.avatarUrl },
    });
  }

  const publicIdentity = await ensureVisitorPublicIdentity(context, visitor.id);
  const existingVisitor = await getVisitor(context, visitor.id);
  const existingBestScore = existingVisitor?.best_score ?? 0;
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
  const authorization = context.req.header("authorization");
  const session = await resolveSession(context.env, authorization);
  if (authorization && !session) return context.json({ ok: false, error: "invalid_session" }, 401);
  const clientId = context.req.query("client_id") ?? null;
  const limit = getLeaderboardLimit(context.req.query("limit"));
  const around = context.req.query("around") === "current" ? "current" : "top";
  const visitor = clientId ? await resolveVisitor(context, clientId) : { ok: false } as const;
  const currentUserId = session ? `user:${session.userId}` : visitor.ok ? `visitor:${visitor.id}` : null;

  if (visitor.ok && !session) {
    await ensureVisitorPublicIdentity(context, visitor.id);
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
      identity: row.identity_type === "authenticated"
        ? { type: "authenticated", displayName: row.display_name, avatarUrl: row.avatar_url }
        : { type: "anonymous", publicColorId: row.public_color_id, publicNameId: row.public_name_id },
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
      visitor_id: typeof event.visitor_id === "string" ? event.visitor_id : undefined,
      analytics_session_id: typeof event.analytics_session_id === "string"
        ? event.analytics_session_id
        : undefined,
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
    "SELECT id, public_color_id, public_name_id, best_score FROM visitors WHERE id = ?",
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
    `WITH combined AS (
      SELECT 'visitor:' || id AS id, best_score, created_at FROM visitors
      WHERE user_id IS NULL AND best_score > 0 AND public_color_id IS NOT NULL AND public_name_id IS NOT NULL
      UNION ALL
      SELECT 'user:' || id AS id, best_score, created_at FROM users WHERE best_score > 0
    ), ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY best_score DESC, created_at ASC, id ASC) AS rank FROM combined
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
    `WITH combined AS (
      SELECT 'visitor:' || id AS id, best_score, created_at, 'anonymous' AS identity_type,
        public_color_id, public_name_id, NULL AS display_name, NULL AS avatar_url
      FROM visitors
      WHERE user_id IS NULL AND best_score > 0 AND public_color_id IS NOT NULL AND public_name_id IS NOT NULL
      UNION ALL
      SELECT 'user:' || id AS id, best_score, created_at, 'authenticated' AS identity_type,
        NULL AS public_color_id, NULL AS public_name_id, display_name, avatar_url
      FROM users WHERE best_score > 0
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY best_score DESC, created_at ASC, id ASC) AS rank FROM combined
    )
    SELECT id, best_score, identity_type, public_color_id, public_name_id, display_name, avatar_url, rank
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

type GameSettingsHistoryRow = {
  version: number;
  config: string;
  operation: "baseline" | "update" | "defaults" | "restore";
  created_at: string;
  actor_email: string;
  restored_from_version: number | null;
};

const ADMIN_EMAIL_ALLOWLIST = new Set(["gerasymenkoden@gmail.com"]);

async function getAdminAuth(context: AppContext): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof resolveSession>>> }
  | { ok: false; status: 401 | 403; error: "invalid_session" | "admin_access_denied" }
> {
  const session = await resolveSession(context.env, context.req.header("authorization"));
  if (!session) return { ok: false, status: 401, error: "invalid_session" };
  if (!session.email || !ADMIN_EMAIL_ALLOWLIST.has(session.email.toLowerCase())) {
    return { ok: false, status: 403, error: "admin_access_denied" };
  }
  return { ok: true, session };
}

function readPositiveInteger(value: unknown): number | null {
  const candidate = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 1 ? candidate : null;
}

function serializeGameSettings(settings: Awaited<ReturnType<typeof readGameSettings>>) {
  return {
    version: settings.version,
    config: settings.config,
    updated_at: settings.updatedAt,
    updated_by_email: settings.updatedByEmail,
  };
}

function serializeUser(session: {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  bestScore: number;
}) {
  return {
    id: session.userId,
    display_name: session.displayName,
    avatar_url: session.avatarUrl,
    best_score: session.bestScore,
  };
}

export default app;
