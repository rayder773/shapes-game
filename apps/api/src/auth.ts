export type AuthBindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  SESSION_TOKEN_PEPPER?: string;
  RATE_LIMIT_SALT?: string;
};

export type AuthenticatedSession = {
  sessionId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  bestScore: number;
};

type GoogleClaims = {
  sub: string;
  name: string;
  picture: string | null;
  aud: string;
  iss: string;
  exp: number;
};

const SESSION_IDLE_MS = 90 * 24 * 60 * 60 * 1000;
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
let cachedGoogleKeys: { expiresAt: number; keys: JsonWebKey[] } | null = null;

export async function verifyGoogleCredential(
  credential: string,
  clientId: string | undefined,
): Promise<GoogleClaims | null> {
  if (!clientId) return null;
  const parts = credential.split(".");
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(decodeBase64Url(parts[0]!)) as { alg?: unknown; kid?: unknown };
    const payload = JSON.parse(decodeBase64Url(parts[1]!)) as Record<string, unknown>;
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
    if (
      typeof payload.sub !== "string" || !payload.sub ||
      typeof payload.name !== "string" || !payload.name.trim() ||
      typeof payload.aud !== "string" || payload.aud !== clientId ||
      typeof payload.iss !== "string" || !GOOGLE_ISSUERS.has(payload.iss) ||
      typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)
    ) return null;

    const key = (await getGoogleKeys()).find(
      (candidate) => (candidate as JsonWebKey & { kid?: string }).kid === header.kid,
    );
    if (!key) return null;
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      decodeBase64UrlBytes(parts[2]!),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return null;

    return {
      sub: payload.sub,
      name: payload.name.trim().slice(0, 200),
      picture: typeof payload.picture === "string" && isSafeAvatarUrl(payload.picture)
        ? payload.picture.slice(0, 2048)
        : null,
      aud: payload.aud,
      iss: payload.iss,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function createOrMergeGoogleUser(
  env: AuthBindings,
  claims: GoogleClaims,
  visitorId: string,
  localBestScore: number,
): Promise<{ session: AuthenticatedSession; token: string }> {
  const now = new Date().toISOString();
  let identity = await env.DB.prepare(
    `SELECT users.id, users.best_score FROM auth_identities
     JOIN users ON users.id = auth_identities.user_id
     WHERE auth_identities.provider = 'google' AND auth_identities.provider_id = ?`,
  ).bind(claims.sub).first<{ id: string; best_score: number }>();

  let userId = identity?.id;
  if (!userId) {
    userId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users (id, display_name, avatar_url, best_score, created_at, last_login_at)
         VALUES (?, ?, ?, 0, ?, ?)`,
      ).bind(userId, claims.name, claims.picture, now, now),
      env.DB.prepare(
        `INSERT INTO auth_identities (user_id, provider, provider_id, created_at)
         VALUES (?, 'google', ?, ?)`,
      ).bind(userId, claims.sub, now),
    ]);
    identity = { id: userId, best_score: 0 };
  }

  const visitor = await env.DB.prepare("SELECT best_score FROM visitors WHERE id = ?")
    .bind(visitorId).first<{ best_score: number }>();
  const bestScore = Math.max(identity?.best_score ?? 0, visitor?.best_score ?? 0, localBestScore);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE users SET display_name = ?, avatar_url = ?, best_score = ?,
       best_score_updated_at = CASE WHEN best_score < ? THEN ? ELSE best_score_updated_at END,
       last_login_at = ? WHERE id = ?`,
    ).bind(claims.name, claims.picture, bestScore, bestScore, now, now, userId),
    env.DB.prepare("UPDATE visitors SET user_id = ? WHERE id = ?")
      .bind(userId, visitorId),
  ]);

  const issued = await issueSession(env, userId);
  return {
    token: issued.token,
    session: {
      sessionId: issued.sessionId,
      userId,
      displayName: claims.name,
      avatarUrl: claims.picture,
      bestScore,
    },
  };
}

export async function resolveSession(
  env: AuthBindings,
  authorization: string | undefined,
  touch = true,
): Promise<AuthenticatedSession | null> {
  const token = readBearerToken(authorization);
  if (!token) return null;
  const tokenHash = await hashSecret(token, env.SESSION_TOKEN_PEPPER);
  const row = await env.DB.prepare(
    `SELECT sessions.id AS session_id, sessions.user_id, sessions.expires_at,
      users.display_name, users.avatar_url, users.best_score
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.revoked_at IS NULL`,
  ).bind(tokenHash).first<{
    session_id: string; user_id: string; expires_at: string; display_name: string;
    avatar_url: string | null; best_score: number;
  }>();
  if (!row) return null;
  if (Date.parse(row.expires_at) <= Date.now()) {
    await env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), row.session_id).run();
    return null;
  }
  if (touch) {
    const now = new Date();
    await env.DB.prepare("UPDATE sessions SET last_active_at = ?, expires_at = ? WHERE id = ?")
      .bind(now.toISOString(), new Date(now.getTime() + SESSION_IDLE_MS).toISOString(), row.session_id).run();
  }
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bestScore: row.best_score,
  };
}

export async function revokeSession(env: AuthBindings, authorization: string | undefined): Promise<void> {
  const token = readBearerToken(authorization);
  if (!token) return;
  const tokenHash = await hashSecret(token, env.SESSION_TOKEN_PEPPER);
  await env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), tokenHash).run();
}

export async function deleteAccount(env: AuthBindings, session: AuthenticatedSession): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE events SET actor_user_id = NULL WHERE actor_user_id = ?").bind(session.userId),
    env.DB.prepare(
      `UPDATE visitors SET user_id = NULL, best_score = 0, best_score_updated_at = ? WHERE user_id = ?`,
    ).bind(now, session.userId),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(session.userId),
    env.DB.prepare("DELETE FROM auth_identities WHERE user_id = ?").bind(session.userId),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(session.userId),
  ]);
}

export async function consumeRateLimit(
  env: AuthBindings,
  scope: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const subjectHash = await hashSecret(subject, env.RATE_LIMIT_SALT);
  await env.DB.prepare(
    `INSERT INTO rate_limits (scope, subject_hash, window_started_at, request_count, expires_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(scope, subject_hash, window_started_at)
     DO UPDATE SET request_count = request_count + 1`,
  ).bind(scope, subjectHash, windowStart, windowStart + windowSeconds * 2).run();
  const row = await env.DB.prepare(
    "SELECT request_count FROM rate_limits WHERE scope = ? AND subject_hash = ? AND window_started_at = ?",
  ).bind(scope, subjectHash, windowStart).first<{ request_count: number }>();
  if (Math.random() < 0.02) {
    await env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(now).run();
  }
  return (row?.request_count ?? limit + 1) <= limit;
}

async function issueSession(env: AuthBindings, userId: string): Promise<{ token: string; sessionId: string }> {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await hashSecret(token, env.SESSION_TOKEN_PEPPER);
  const sessionId = crypto.randomUUID();
  const now = new Date();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, last_active_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    sessionId, userId, tokenHash, now.toISOString(), now.toISOString(),
    new Date(now.getTime() + SESSION_IDLE_MS).toISOString(),
  ).run();
  return { token, sessionId };
}

async function getGoogleKeys(): Promise<JsonWebKey[]> {
  if (cachedGoogleKeys && cachedGoogleKeys.expiresAt > Date.now()) return cachedGoogleKeys.keys;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) throw new Error("google_jwks_unavailable");
  const body = await response.json() as { keys?: JsonWebKey[] };
  if (!Array.isArray(body.keys)) throw new Error("google_jwks_invalid");
  const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] ?? 3600);
  cachedGoogleKeys = { keys: body.keys, expiresAt: Date.now() + maxAge * 1000 };
  return body.keys;
}

async function hashSecret(value: string, secret = ""): Promise<string> {
  const bytes = new TextEncoder().encode(`${secret}\0${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToBase64Url(new Uint8Array(digest));
}

function readBearerToken(value: string | undefined): string | null {
  const match = value?.match(/^Bearer ([A-Za-z0-9_-]{20,})$/);
  return match?.[1] ?? null;
}

function isSafeAvatarUrl(value: string): boolean {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function decodeBase64Url(value: string): string {
  return new TextDecoder().decode(decodeBase64UrlBytes(value));
}

function decodeBase64UrlBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
