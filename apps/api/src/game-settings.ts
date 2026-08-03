import type { AuthenticatedSession } from "./auth";

export type GameplaySettingsValues = {
  targetSpeed: number;
  playerSpeed: number;
  playerBoostSpeed: number;
  maxTargets: number;
  targetGrowthScoreStep: number;
  lifeSpawnChancePercent: number;
  coinSpawnChancePercent: number;
  lifePickupLifetimeSeconds: number;
  coinPickupLifetimeSeconds: number;
  startLives: number;
  maxLives: number;
};

export type GameSettingsConfig = {
  compactTouch: GameplaySettingsValues;
  desktop: GameplaySettingsValues;
};

export type GameSettingsRecord = {
  version: number;
  config: GameSettingsConfig;
  updatedAt: string;
  updatedByEmail: string;
};

type SettingsRow = {
  version: number;
  config: string;
  updated_at: string;
  updated_by_email: string;
};

export const DEFAULT_GAME_SETTINGS: GameSettingsConfig = {
  compactTouch: {
    targetSpeed: 2, playerSpeed: 5, playerBoostSpeed: 10, maxTargets: 12,
    targetGrowthScoreStep: 3, lifeSpawnChancePercent: 15, coinSpawnChancePercent: 40,
    lifePickupLifetimeSeconds: 3, coinPickupLifetimeSeconds: 3, startLives: 3, maxLives: 5,
  },
  desktop: {
    targetSpeed: 2, playerSpeed: 5, playerBoostSpeed: 10, maxTargets: 20,
    targetGrowthScoreStep: 3, lifeSpawnChancePercent: 15, coinSpawnChancePercent: 40,
    lifePickupLifetimeSeconds: 3, coinPickupLifetimeSeconds: 3, startLives: 3, maxLives: 5,
  },
};

const limits: Record<keyof GameplaySettingsValues, { min: number; max: number }> = {
  targetSpeed: { min: 0, max: 30 }, playerSpeed: { min: 0, max: 30 },
  playerBoostSpeed: { min: 0, max: 30 }, maxTargets: { min: 0, max: 30 },
  targetGrowthScoreStep: { min: 0, max: 30 }, lifeSpawnChancePercent: { min: 0, max: 100 },
  coinSpawnChancePercent: { min: 0, max: 100 }, lifePickupLifetimeSeconds: { min: 1, max: 10 },
  coinPickupLifetimeSeconds: { min: 1, max: 10 }, startLives: { min: 1, max: 10 },
  maxLives: { min: 1, max: 10 },
};

export function parseGameSettingsConfig(value: unknown): GameSettingsConfig | null {
  if (!isRecord(value)) return null;
  const compactTouch = parseProfile(value.compactTouch);
  const desktop = parseProfile(value.desktop);
  if (!compactTouch || !desktop) return null;
  return { compactTouch, desktop };
}

export async function readGameSettings(db: D1Database): Promise<GameSettingsRecord> {
  const row = await db.prepare(
    "SELECT version, config, updated_at, updated_by_email FROM game_settings WHERE id = 1",
  ).first<SettingsRow>();
  const config = row ? parseStoredConfig(row.config) : DEFAULT_GAME_SETTINGS;
  return {
    version: row?.version ?? 0,
    config,
    updatedAt: row?.updated_at ?? new Date(0).toISOString(),
    updatedByEmail: row?.updated_by_email ?? "system",
  };
}

export async function writeGameSettings(
  db: D1Database,
  session: AuthenticatedSession,
  config: GameSettingsConfig,
  expectedVersion: number,
  operation: "update" | "defaults" | "restore",
  restoredFromVersion: number | null = null,
): Promise<GameSettingsRecord | null> {
  const current = await readGameSettings(db);
  if (current.version !== expectedVersion) return null;
  const version = current.version + 1;
  const now = new Date().toISOString();
  const serialized = JSON.stringify(config);
  const update = db.prepare(
    `UPDATE game_settings SET version = ?, config = ?, updated_at = ?,
     updated_by_user_id = ?, updated_by_email = ? WHERE id = 1 AND version = ?`,
  ).bind(version, serialized, now, session.userId, session.email ?? "unknown", expectedVersion);
  const history = db.prepare(
    `INSERT INTO game_settings_history
     (version, config, operation, created_at, actor_user_id, actor_email, restored_from_version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(version, serialized, operation, now, session.userId, session.email ?? "unknown", restoredFromVersion);
  let results: D1Result[];
  try { results = await db.batch([update, history]); }
  catch { return null; }
  if (!results[0]?.success || (results[0].meta?.changes ?? 0) !== 1) return null;
  return { version, config, updatedAt: now, updatedByEmail: session.email ?? "unknown" };
}

export async function readHistoryConfig(db: D1Database, version: number): Promise<GameSettingsConfig | null> {
  const row = await db.prepare("SELECT config FROM game_settings_history WHERE version = ?")
    .bind(version).first<{ config: string }>();
  return row ? parseStoredConfig(row.config) : null;
}

function parseProfile(value: unknown): GameplaySettingsValues | null {
  if (!isRecord(value)) return null;
  const result = {} as GameplaySettingsValues;
  for (const [field, range] of Object.entries(limits) as Array<[keyof GameplaySettingsValues, { min: number; max: number }]>) {
    const candidate = value[field];
    if (typeof candidate !== "number" || !Number.isInteger(candidate) || candidate < range.min || candidate > range.max) {
      return null;
    }
    result[field] = candidate;
  }
  if (result.startLives > result.maxLives) return null;
  return result;
}

function parseStoredConfig(value: string): GameSettingsConfig {
  try { return parseGameSettingsConfig(JSON.parse(value)) ?? DEFAULT_GAME_SETTINGS; }
  catch { return DEFAULT_GAME_SETTINGS; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
