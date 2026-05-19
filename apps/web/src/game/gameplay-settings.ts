export type GameplayProfileKey = "compactTouch" | "desktop";

export type GameplayProfileOverrides = {
  targetSpeed?: number;
  playerSpeed?: number;
  playerBoostSpeed?: number;
  maxTargets?: number;
  targetGrowthScoreStep?: number;
  lifeSpawnChancePercent?: number;
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
  startLives: number;
  maxLives: number;
};

export const DEFAULT_TARGET_GROWTH_SCORE_STEP = 3;
export const GAMEPLAY_SETTINGS_STORAGE_KEY = "shapes-game.gameplaySettings";

const GAMEPLAY_SETTINGS_LIMITS: Record<keyof GameplaySettingsValues, { min: number; max: number }> = {
  targetSpeed: { min: 0, max: 30 },
  playerSpeed: { min: 0, max: 30 },
  playerBoostSpeed: { min: 0, max: 30 },
  maxTargets: { min: 0, max: 30 },
  targetGrowthScoreStep: { min: 0, max: 30 },
  lifeSpawnChancePercent: { min: 0, max: 100 },
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

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      compactTouch: sanitizeGameplayProfileOverrides(parsed.compactTouch),
      desktop: sanitizeGameplayProfileOverrides(parsed.desktop),
    };
  } catch {
    return createEmptySavedGameplaySettings();
  }
}

export function saveGameplaySettings(settings: SavedGameplaySettings): void {
  window.localStorage.setItem(GAMEPLAY_SETTINGS_STORAGE_KEY, JSON.stringify({
    compactTouch: sanitizeGameplayProfileOverrides(settings.compactTouch),
    desktop: sanitizeGameplayProfileOverrides(settings.desktop),
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
    startLives: Math.min(startLives, maxLives),
    maxLives,
  };
}

export function createPersistableOverrides(
  values: GameplaySettingsValues,
  defaults: GameplaySettingsValues,
): GameplayProfileOverrides {
  const overrides: GameplayProfileOverrides = {};

  if (values.targetSpeed !== defaults.targetSpeed) {
    overrides.targetSpeed = clampGameplaySettingValue(values.targetSpeed, "targetSpeed");
  }

  if (values.playerSpeed !== defaults.playerSpeed) {
    overrides.playerSpeed = clampGameplaySettingValue(values.playerSpeed, "playerSpeed");
  }

  if (values.playerBoostSpeed !== defaults.playerBoostSpeed) {
    overrides.playerBoostSpeed = clampGameplaySettingValue(values.playerBoostSpeed, "playerBoostSpeed");
  }

  if (values.maxTargets !== defaults.maxTargets) {
    overrides.maxTargets = clampGameplaySettingValue(values.maxTargets, "maxTargets");
  }

  if (values.targetGrowthScoreStep !== defaults.targetGrowthScoreStep) {
    overrides.targetGrowthScoreStep = clampGameplaySettingValue(values.targetGrowthScoreStep, "targetGrowthScoreStep");
  }

  if (values.lifeSpawnChancePercent !== defaults.lifeSpawnChancePercent) {
    overrides.lifeSpawnChancePercent = clampGameplaySettingValue(values.lifeSpawnChancePercent, "lifeSpawnChancePercent");
  }

  if (values.startLives !== defaults.startLives) {
    overrides.startLives = clampGameplaySettingValue(values.startLives, "startLives");
  }

  if (values.maxLives !== defaults.maxLives) {
    overrides.maxLives = clampGameplaySettingValue(values.maxLives, "maxLives");
  }

  return overrides;
}
