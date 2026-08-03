export type GameplayProfileKey = "compactTouch" | "desktop";

export type GameplayProfileOverrides = {
  targetSpeed?: number;
  playerSpeed?: number;
  playerBoostSpeed?: number;
  maxTargets?: number;
  targetGrowthScoreStep?: number;
  lifeSpawnChancePercent?: number;
  coinSpawnChancePercent?: number;
  lifePickupLifetimeSeconds?: number;
  coinPickupLifetimeSeconds?: number;
  startLives?: number;
  maxLives?: number;
};

export type SavedGameplaySettings = {
  compactTouch: GameplayProfileOverrides;
  desktop: GameplayProfileOverrides;
};

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

export const DEFAULT_TARGET_GROWTH_SCORE_STEP = 3;
export const GAMEPLAY_SETTINGS_STORAGE_KEY = "shapes-game.remoteGameplaySettings";
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

const GAMEPLAY_SETTINGS_LIMITS: Record<keyof GameplaySettingsValues, { min: number; max: number }> = {
  targetSpeed: { min: 0, max: 30 },
  playerSpeed: { min: 0, max: 30 },
  playerBoostSpeed: { min: 0, max: 30 },
  maxTargets: { min: 0, max: 30 },
  targetGrowthScoreStep: { min: 0, max: 30 },
  lifeSpawnChancePercent: { min: 0, max: 100 },
  coinSpawnChancePercent: { min: 0, max: 100 },
  lifePickupLifetimeSeconds: { min: 1, max: 10 },
  coinPickupLifetimeSeconds: { min: 1, max: 10 },
  startLives: { min: 1, max: 10 },
  maxLives: { min: 1, max: 10 },
};

export function createEmptySavedGameplaySettings(): SavedGameplaySettings {
  return {
    compactTouch: {},
    desktop: {},
  };
}

export function clampGameplaySettingValue(
  value: number,
  field: keyof GameplaySettingsValues = "targetSpeed",
): number {
  const limits = GAMEPLAY_SETTINGS_LIMITS[field];
  const rounded = Math.round(value);
  return Math.max(limits.min, Math.min(limits.max, rounded));
}

export function sanitizeGameplayProfileOverrides(value: unknown): GameplayProfileOverrides {
  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  const overrides: GameplayProfileOverrides = {};

  if (typeof candidate.targetSpeed === "number" && Number.isFinite(candidate.targetSpeed)) {
    overrides.targetSpeed = clampGameplaySettingValue(candidate.targetSpeed, "targetSpeed");
  }

  if (typeof candidate.playerSpeed === "number" && Number.isFinite(candidate.playerSpeed)) {
    overrides.playerSpeed = clampGameplaySettingValue(candidate.playerSpeed, "playerSpeed");
  }

  if (typeof candidate.playerBoostSpeed === "number" && Number.isFinite(candidate.playerBoostSpeed)) {
    overrides.playerBoostSpeed = clampGameplaySettingValue(candidate.playerBoostSpeed, "playerBoostSpeed");
  }

  if (typeof candidate.maxTargets === "number" && Number.isFinite(candidate.maxTargets)) {
    overrides.maxTargets = clampGameplaySettingValue(candidate.maxTargets, "maxTargets");
  }

  if (
    typeof candidate.targetGrowthScoreStep === "number"
    && Number.isFinite(candidate.targetGrowthScoreStep)
  ) {
    overrides.targetGrowthScoreStep = clampGameplaySettingValue(candidate.targetGrowthScoreStep, "targetGrowthScoreStep");
  }

  if (
    typeof candidate.lifeSpawnChancePercent === "number"
    && Number.isFinite(candidate.lifeSpawnChancePercent)
  ) {
    overrides.lifeSpawnChancePercent = clampGameplaySettingValue(candidate.lifeSpawnChancePercent, "lifeSpawnChancePercent");
  }

  if (
    typeof candidate.coinSpawnChancePercent === "number"
    && Number.isFinite(candidate.coinSpawnChancePercent)
  ) {
    overrides.coinSpawnChancePercent = clampGameplaySettingValue(candidate.coinSpawnChancePercent, "coinSpawnChancePercent");
  }

  if (
    typeof candidate.lifePickupLifetimeSeconds === "number"
    && Number.isFinite(candidate.lifePickupLifetimeSeconds)
  ) {
    overrides.lifePickupLifetimeSeconds = clampGameplaySettingValue(candidate.lifePickupLifetimeSeconds, "lifePickupLifetimeSeconds");
  }

  if (
    typeof candidate.coinPickupLifetimeSeconds === "number"
    && Number.isFinite(candidate.coinPickupLifetimeSeconds)
  ) {
    overrides.coinPickupLifetimeSeconds = clampGameplaySettingValue(candidate.coinPickupLifetimeSeconds, "coinPickupLifetimeSeconds");
  }

  if (typeof candidate.startLives === "number" && Number.isFinite(candidate.startLives)) {
    overrides.startLives = clampGameplaySettingValue(candidate.startLives, "startLives");
  }

  if (typeof candidate.maxLives === "number" && Number.isFinite(candidate.maxLives)) {
    overrides.maxLives = clampGameplaySettingValue(candidate.maxLives, "maxLives");
  }

  return overrides;
}

export function loadSavedGameplaySettings(): SavedGameplaySettings {
  if (typeof window === "undefined") {
    return createEmptySavedGameplaySettings();
  }

  try {
    const raw = window.localStorage.getItem(GAMEPLAY_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return createEmptySavedGameplaySettings();
    }

    const stored = JSON.parse(raw) as Record<string, unknown>;
    const parsed = (stored.config && typeof stored.config === "object" ? stored.config : stored) as Record<string, unknown>;
    return {
      compactTouch: sanitizeGameplayProfileOverrides(parsed.compactTouch),
      desktop: sanitizeGameplayProfileOverrides(parsed.desktop),
    };
  } catch {
    return createEmptySavedGameplaySettings();
  }
}

export async function refreshGameplaySettings(timeoutMs = 3_000): Promise<SavedGameplaySettings | null> {
  if (navigator.onLine === false) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}/game-settings`, { signal: controller.signal });
    const body = await response.json() as { ok?: boolean; version?: unknown; config?: unknown };
    if (!response.ok || body.ok !== true || !Number.isInteger(body.version) || !body.config || typeof body.config !== "object") return null;
    const config = body.config as Record<string, unknown>;
    const settings = {
      compactTouch: sanitizeGameplayProfileOverrides(config.compactTouch),
      desktop: sanitizeGameplayProfileOverrides(config.desktop),
    };
    if (Object.keys(settings.compactTouch).length !== 11 || Object.keys(settings.desktop).length !== 11) return null;
    cacheGameplaySettings(settings, body.version as number);
    return settings;
  } catch { return null; }
  finally { window.clearTimeout(timeout); }
}

function cacheGameplaySettings(settings: SavedGameplaySettings, version: number): void {
  window.localStorage.setItem(GAMEPLAY_SETTINGS_STORAGE_KEY, JSON.stringify({
    version,
    config: {
      compactTouch: sanitizeGameplayProfileOverrides(settings.compactTouch),
      desktop: sanitizeGameplayProfileOverrides(settings.desktop),
    },
  }));
}

export function applyGameplayOverrides(
  defaults: GameplaySettingsValues,
  overrides: GameplayProfileOverrides,
): GameplaySettingsValues {
  const maxLives = overrides.maxLives ?? defaults.maxLives;
  const startLives = overrides.startLives ?? defaults.startLives;

  return {
    targetSpeed: overrides.targetSpeed ?? defaults.targetSpeed,
    playerSpeed: overrides.playerSpeed ?? defaults.playerSpeed,
    playerBoostSpeed: overrides.playerBoostSpeed ?? defaults.playerBoostSpeed,
    maxTargets: overrides.maxTargets ?? defaults.maxTargets,
    targetGrowthScoreStep: overrides.targetGrowthScoreStep ?? defaults.targetGrowthScoreStep,
    lifeSpawnChancePercent: overrides.lifeSpawnChancePercent ?? defaults.lifeSpawnChancePercent,
    coinSpawnChancePercent: overrides.coinSpawnChancePercent ?? defaults.coinSpawnChancePercent,
    lifePickupLifetimeSeconds: overrides.lifePickupLifetimeSeconds ?? defaults.lifePickupLifetimeSeconds,
    coinPickupLifetimeSeconds: overrides.coinPickupLifetimeSeconds ?? defaults.coinPickupLifetimeSeconds,
    startLives: Math.min(startLives, maxLives),
    maxLives,
  };
}
