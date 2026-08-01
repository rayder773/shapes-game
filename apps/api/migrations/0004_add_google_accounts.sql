CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  best_score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL,
  best_score_updated_at TEXT
);

CREATE TABLE auth_identities (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider = 'google'),
  provider_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(provider, provider_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

ALTER TABLE visitors ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN actor_type TEXT NOT NULL DEFAULT 'anonymous'
  CHECK (actor_type IN ('anonymous', 'authenticated'));
ALTER TABLE events ADD COLUMN actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN analytics_session_id TEXT;

CREATE TABLE rate_limits (
  scope TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY(scope, subject_hash, window_started_at)
);

CREATE INDEX visitors_user_id_idx ON visitors(user_id);
CREATE INDEX users_best_score_idx ON users(best_score DESC, created_at ASC, id ASC);
CREATE INDEX sessions_token_hash_idx ON sessions(token_hash);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX events_actor_user_id_idx ON events(actor_user_id, id DESC);
CREATE INDEX events_analytics_session_id_idx ON events(analytics_session_id);
CREATE INDEX rate_limits_expiry_idx ON rate_limits(expires_at);
