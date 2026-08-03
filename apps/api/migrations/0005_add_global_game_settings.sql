ALTER TABLE users ADD COLUMN email TEXT;
CREATE INDEX users_email_idx ON users(email);

CREATE TABLE game_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  config TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_email TEXT NOT NULL
);

CREATE TABLE game_settings_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL UNIQUE,
  config TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('baseline', 'update', 'defaults', 'restore')),
  created_at TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  restored_from_version INTEGER
);

CREATE INDEX game_settings_history_version_idx ON game_settings_history(version DESC);

INSERT INTO game_settings (id, version, config, updated_at, updated_by_email)
VALUES (
  1,
  1,
  '{"compactTouch":{"targetSpeed":2,"playerSpeed":5,"playerBoostSpeed":10,"maxTargets":12,"targetGrowthScoreStep":3,"lifeSpawnChancePercent":15,"coinSpawnChancePercent":40,"lifePickupLifetimeSeconds":3,"coinPickupLifetimeSeconds":3,"startLives":3,"maxLives":5},"desktop":{"targetSpeed":2,"playerSpeed":5,"playerBoostSpeed":10,"maxTargets":20,"targetGrowthScoreStep":3,"lifeSpawnChancePercent":15,"coinSpawnChancePercent":40,"lifePickupLifetimeSeconds":3,"coinPickupLifetimeSeconds":3,"startLives":3,"maxLives":5}}',
  CURRENT_TIMESTAMP,
  'system'
);

INSERT INTO game_settings_history (version, config, operation, created_at, actor_email)
SELECT version, config, 'baseline', updated_at, updated_by_email FROM game_settings WHERE id = 1;
