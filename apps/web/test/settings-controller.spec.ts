import { beforeEach, describe, expect, test } from "vitest";
import {
  configureSettingsController,
  persistActiveProfileSettings,
  resetSettingsDraftToDefaults,
  subscribeToSettingsState,
  updateSettingsDraft,
} from "../src/settings/settings-controller.ts";
import type { SettingsEntity } from "../src/game/game-runtime.ts";

function createSettingsEntity(): SettingsEntity {
  return {
    id: 0,
    settingsState: {
      activeProfileKey: "desktop",
      saved: {
        compactTouch: {},
        desktop: {},
      },
      draft: {
        targetSpeed: 2,
        playerSpeed: 4,
        playerBoostSpeed: 7,
        maxTargets: 8,
        targetGrowthScoreStep: 5,
        lifeSpawnChancePercent: 10,
        startLives: 3,
        maxLives: 5,
      },
      defaults: {
        targetSpeed: 2,
        playerSpeed: 4,
        playerBoostSpeed: 7,
        maxTargets: 8,
        targetGrowthScoreStep: 5,
        lifeSpawnChancePercent: 10,
        startLives: 3,
        maxLives: 5,
      },
    },
  };
}

describe("settings controller", () => {
  let settingsEntity: SettingsEntity;
  let persistCount: number;

  beforeEach(() => {
    settingsEntity = createSettingsEntity();
    persistCount = 0;
    configureSettingsController({
      getSettingsEntity: () => settingsEntity,
      onPersistActiveProfileSettings: () => {
        persistCount += 1;
      },
    });
  });

  test("updates draft values, couples lives fields and notifies subscribers", () => {
    const states: Array<{ startLives: number; maxLives: number }> = [];
    const unsubscribe = subscribeToSettingsState((state) => {
      states.push({
        startLives: state.draft.startLives,
        maxLives: state.draft.maxLives,
      });
    });

    updateSettingsDraft("startLives", 6);
    expect(settingsEntity.settingsState.draft.maxLives).toBe(6);

    updateSettingsDraft("maxLives", 4);
    expect(settingsEntity.settingsState.draft.startLives).toBe(4);

    unsubscribe();
    updateSettingsDraft("startLives", 5);

    expect(states).toEqual([
      { startLives: 3, maxLives: 5 },
      { startLives: 6, maxLives: 6 },
      { startLives: 4, maxLives: 4 },
    ]);
  });

  test("resets draft and persists active profile overrides", () => {
    updateSettingsDraft("targetSpeed", 8);
    updateSettingsDraft("maxLives", 7);

    resetSettingsDraftToDefaults();

    expect(settingsEntity.settingsState.draft.targetSpeed).toBe(2);
    expect(settingsEntity.settingsState.draft.maxLives).toBe(5);

    updateSettingsDraft("targetSpeed", 9);
    persistActiveProfileSettings();

    expect(settingsEntity.settingsState.saved.desktop.targetSpeed).toBe(9);
    expect(persistCount).toBe(1);
    expect(JSON.parse(window.localStorage.getItem("shapes-game.gameplaySettings") ?? "{}").desktop.targetSpeed).toBe(9);
  });
});
