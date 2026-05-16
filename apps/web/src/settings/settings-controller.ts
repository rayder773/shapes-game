import {
  clampGameplaySettingValue,
  createPersistableOverrides,
  saveGameplaySettings,
  type GameplaySettingsValues,
} from "../game/gameplay-settings.ts";
import type { SettingsEntity } from "../game/game-runtime.ts";

export type SettingsViewState = {
  activeProfileKey: SettingsEntity["settingsState"]["activeProfileKey"];
  draft: GameplaySettingsValues;
};

type SettingsStateListener = (state: SettingsViewState) => void;

type SettingsControllerDependencies = {
  getSettingsEntity: () => SettingsEntity | null;
  onPersistActiveProfileSettings: () => void;
};

const settingsStateListeners = new Set<SettingsStateListener>();
let dependencies: SettingsControllerDependencies | null = null;

function getSettingsEntity(): SettingsEntity | null {
  return dependencies?.getSettingsEntity() ?? null;
}

export function configureSettingsController(nextDependencies: SettingsControllerDependencies): void {
  dependencies = nextDependencies;
}

function getSettingsViewState(): SettingsViewState | null {
  const settingsEntity = getSettingsEntity();
  if (!settingsEntity) return null;

  return {
    activeProfileKey: settingsEntity.settingsState.activeProfileKey,
    draft: settingsEntity.settingsState.draft,
  };
}

export function notifySettingsStateListeners(): void {
  const state = getSettingsViewState();
  if (!state) return;

  for (const listener of settingsStateListeners) {
    listener(state);
  }
}

export function subscribeToSettingsState(listener: SettingsStateListener): () => void {
  settingsStateListeners.add(listener);
  const state = getSettingsViewState();
  if (state) {
    listener(state);
  }

  return () => {
    settingsStateListeners.delete(listener);
  };
}

export function updateSettingsDraft(field: keyof GameplaySettingsValues, value: number): void {
  const settingsEntity = getSettingsEntity();
  if (!settingsEntity) return;

  settingsEntity.settingsState.draft[field] = clampGameplaySettingValue(value, field);

  if (field === "startLives" && settingsEntity.settingsState.draft.startLives > settingsEntity.settingsState.draft.maxLives) {
    settingsEntity.settingsState.draft.maxLives = settingsEntity.settingsState.draft.startLives;
  }

  if (field === "maxLives" && settingsEntity.settingsState.draft.startLives > settingsEntity.settingsState.draft.maxLives) {
    settingsEntity.settingsState.draft.startLives = settingsEntity.settingsState.draft.maxLives;
  }

  notifySettingsStateListeners();
}

export function resetSettingsDraftToDefaults(): void {
  const settingsEntity = getSettingsEntity();
  if (!settingsEntity) return;

  settingsEntity.settingsState.draft = {
    ...settingsEntity.settingsState.defaults,
  };
  notifySettingsStateListeners();
}

export function persistActiveProfileSettings(): void {
  const settingsEntity = getSettingsEntity();
  if (!settingsEntity || !dependencies) return;

  const { activeProfileKey, defaults, draft, saved } = settingsEntity.settingsState;
  saved[activeProfileKey] = createPersistableOverrides(draft, defaults);
  saveGameplaySettings(saved);
  dependencies.onPersistActiveProfileSettings();
}
