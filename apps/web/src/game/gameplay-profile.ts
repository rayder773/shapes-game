import { isPhoneDevice } from "../platform/device.ts";
import {
  applyGameplayOverrides,
  createEmptySavedGameplaySettings,
  DEFAULT_TARGET_GROWTH_SCORE_STEP,
  type GameplayProfileKey,
  type GameplaySettingsValues,
  type SavedGameplaySettings,
} from "./gameplay-settings.ts";
import type {
  CanvasMetrics,
  GameplayProfile,
  SettingsEntity,
} from "./game-runtime.ts";
import { notifySettingsStateListeners } from "../settings/settings-controller.ts";

const SETTINGS_ENTITY_ID = 0;

export function createGameplayProfile(_metrics: CanvasMetrics): GameplayProfile {
  const compactTouch = isPhoneDevice();

  if (compactTouch) {
    return {
      compactTouch,
      startTargetCount: 5,
      minTargetsAfterScore: 6,
      targetSpeed: 2,
      playerSpeed: 5,
      playerBoostSpeed: 10,
      maxTargets: 12,
      targetGrowthScoreStep: DEFAULT_TARGET_GROWTH_SCORE_STEP,
      lifeSpawnChance: 0.15,
      coinSpawnChance: 0.15,
      startLives: 3,
      maxLives: 5,
      spawnPadding: 2.25,
      safeSpawnPadding: 3.1,
    };
  }

  return {
    compactTouch,
    startTargetCount: 9,
    minTargetsAfterScore: 10,
    targetSpeed: 2,
    playerSpeed: 5,
    playerBoostSpeed: 10,
    maxTargets: 20,
    targetGrowthScoreStep: DEFAULT_TARGET_GROWTH_SCORE_STEP,
    lifeSpawnChance: 0.15,
    coinSpawnChance: 0.15,
    startLives: 3,
    maxLives: 5,
    spawnPadding: 1.8,
    safeSpawnPadding: 2.3,
  };
}

export function getGameplayProfileKey(profile: GameplayProfile): GameplayProfileKey {
  return profile.compactTouch ? "compactTouch" : "desktop";
}

export function getGameplaySettingsValues(profile: GameplayProfile): GameplaySettingsValues {
  return {
    targetSpeed: profile.targetSpeed,
    playerSpeed: profile.playerSpeed,
    playerBoostSpeed: profile.playerBoostSpeed,
    maxTargets: profile.maxTargets,
    targetGrowthScoreStep: profile.targetGrowthScoreStep,
    lifeSpawnChancePercent: Math.round(profile.lifeSpawnChance * 100),
    startLives: profile.startLives,
    maxLives: profile.maxLives,
  };
}

function getSavedOverridesForProfile(
  settingsEntity: SettingsEntity | null,
  profileKey: GameplayProfileKey,
) {
  return settingsEntity?.settingsState.saved[profileKey] ?? {};
}

export function syncSettingsStateWithProfile(
  settingsEntity: SettingsEntity | null,
  metrics: CanvasMetrics,
  resetDraft = false,
): void {
  if (!settingsEntity) return;

  const defaultProfile = createGameplayProfile(metrics);
  const activeProfileKey = getGameplayProfileKey(defaultProfile);
  const defaults = getGameplaySettingsValues(defaultProfile);
  const shouldReplaceDraft = resetDraft || settingsEntity.settingsState.activeProfileKey !== activeProfileKey;

  settingsEntity.settingsState.activeProfileKey = activeProfileKey;
  settingsEntity.settingsState.defaults = defaults;

  if (shouldReplaceDraft) {
    settingsEntity.settingsState.draft = applyGameplayOverrides(defaults, settingsEntity.settingsState.saved[activeProfileKey]);
  }

  notifySettingsStateListeners();
}

export function resolveGameplayProfile(
  settingsEntity: SettingsEntity | null,
  metrics: CanvasMetrics,
): GameplayProfile {
  const baseProfile = createGameplayProfile(metrics);
  const profileKey = getGameplayProfileKey(baseProfile);
  const values = applyGameplayOverrides(
    getGameplaySettingsValues(baseProfile),
    getSavedOverridesForProfile(settingsEntity, profileKey),
  );

  return {
    ...baseProfile,
    targetSpeed: values.targetSpeed,
    playerSpeed: values.playerSpeed,
    playerBoostSpeed: values.playerBoostSpeed,
    maxTargets: values.maxTargets,
    targetGrowthScoreStep: values.targetGrowthScoreStep,
    lifeSpawnChance: values.lifeSpawnChancePercent / 100,
    startLives: Math.min(values.startLives, values.maxLives),
    maxLives: values.maxLives,
  };
}

export function createSettingsEntityFromSavedSettings(
  metrics: CanvasMetrics,
  savedSettings: SavedGameplaySettings,
): SettingsEntity {
  const defaultProfile = createGameplayProfile(metrics);
  const activeProfileKey = getGameplayProfileKey(defaultProfile);
  const defaults = getGameplaySettingsValues(defaultProfile);
  const draft = applyGameplayOverrides(defaults, savedSettings[activeProfileKey]);

  return {
    id: SETTINGS_ENTITY_ID,
    settingsState: {
      activeProfileKey,
      saved: {
        compactTouch: savedSettings.compactTouch ?? createEmptySavedGameplaySettings().compactTouch,
        desktop: savedSettings.desktop ?? createEmptySavedGameplaySettings().desktop,
      },
      draft,
      defaults,
    },
  };
}
