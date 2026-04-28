export type GameplayProfileKey = "compactTouch" | "desktop";

export type GameplayProfileOverrides = {
  targetSpeed?: number;
  playerSpeed?: number;
  playerBoostSpeed?: number;
  maxTargets?: number;
  targetGrowthScoreStep?: number;
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
};

export const DEFAULT_TARGET_GROWTH_SCORE_STEP = 3;
export const GAMEPLAY_SETTINGS_STORAGE_KEY = "shapes-game.gameplaySettings";
export const GAMEPLAY_SETTINGS_MIN = 0;
export const GAMEPLAY_SETTINGS_MAX = 30;

export function createEmptySavedGameplaySettings(): SavedGameplaySettings {
  return {
    compactTouch: {},
    desktop: {},
  };
}

export function clampGameplaySettingValue(value: number): number {
  const rounded = Math.round(value);
  return Math.max(GAMEPLAY_SETTINGS_MIN, Math.min(GAMEPLAY_SETTINGS_MAX, rounded));
}

export function sanitizeGameplayProfileOverrides(value: unknown): GameplayProfileOverrides {
  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  const overrides: GameplayProfileOverrides = {};

  if (typeof candidate.targetSpeed === "number" && Number.isFinite(candidate.targetSpeed)) {
    overrides.targetSpeed = clampGameplaySettingValue(candidate.targetSpeed);
  }

  if (typeof candidate.playerSpeed === "number" && Number.isFinite(candidate.playerSpeed)) {
    overrides.playerSpeed = clampGameplaySettingValue(candidate.playerSpeed);
  }

  if (typeof candidate.playerBoostSpeed === "number" && Number.isFinite(candidate.playerBoostSpeed)) {
    overrides.playerBoostSpeed = clampGameplaySettingValue(candidate.playerBoostSpeed);
  }

  if (typeof candidate.maxTargets === "number" && Number.isFinite(candidate.maxTargets)) {
    overrides.maxTargets = clampGameplaySettingValue(candidate.maxTargets);
  }

  if (
    typeof candidate.targetGrowthScoreStep === "number"
    && Number.isFinite(candidate.targetGrowthScoreStep)
  ) {
    overrides.targetGrowthScoreStep = clampGameplaySettingValue(candidate.targetGrowthScoreStep);
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
  return {
    targetSpeed: overrides.targetSpeed ?? defaults.targetSpeed,
    playerSpeed: overrides.playerSpeed ?? defaults.playerSpeed,
    playerBoostSpeed: overrides.playerBoostSpeed ?? defaults.playerBoostSpeed,
    maxTargets: overrides.maxTargets ?? defaults.maxTargets,
    targetGrowthScoreStep: overrides.targetGrowthScoreStep ?? defaults.targetGrowthScoreStep,
  };
}

export function createPersistableOverrides(
  values: GameplaySettingsValues,
  defaults: GameplaySettingsValues,
): GameplayProfileOverrides {
  const overrides: GameplayProfileOverrides = {};

  if (values.targetSpeed !== defaults.targetSpeed) {
    overrides.targetSpeed = clampGameplaySettingValue(values.targetSpeed);
  }

  if (values.playerSpeed !== defaults.playerSpeed) {
    overrides.playerSpeed = clampGameplaySettingValue(values.playerSpeed);
  }

  if (values.playerBoostSpeed !== defaults.playerBoostSpeed) {
    overrides.playerBoostSpeed = clampGameplaySettingValue(values.playerBoostSpeed);
  }

  if (values.maxTargets !== defaults.maxTargets) {
    overrides.maxTargets = clampGameplaySettingValue(values.maxTargets);
  }

  if (values.targetGrowthScoreStep !== defaults.targetGrowthScoreStep) {
    overrides.targetGrowthScoreStep = clampGameplaySettingValue(values.targetGrowthScoreStep);
  }

  return overrides;
}
