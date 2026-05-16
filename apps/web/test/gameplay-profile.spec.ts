import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createGameplayProfile,
  createSettingsEntityFromSavedSettings,
  resolveGameplayProfile,
  syncSettingsStateWithProfile,
} from "../src/game/gameplay-profile.ts";
import type { CanvasMetrics, SettingsEntity } from "../src/game/game-runtime.ts";

const metrics: CanvasMetrics = {
  dpr: 1,
  widthCss: 800,
  heightCss: 600,
  widthPx: 800,
  heightPx: 600,
};

function setPhoneDevice(isPhone: boolean): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: isPhone ? 390 : 1280,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: isPhone ? 844 : 720,
  });
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: isPhone ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" : "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
  });
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: isPhone && (query.includes("pointer: coarse") || query.includes("hover: none")),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

describe("gameplay profile", () => {
  beforeEach(() => {
    setPhoneDevice(false);
  });

  test("creates desktop and compact touch default profiles", () => {
    expect(createGameplayProfile(metrics)).toMatchObject({
      compactTouch: false,
      startTargetCount: 9,
      maxTargets: 20,
    });

    setPhoneDevice(true);

    expect(createGameplayProfile(metrics)).toMatchObject({
      compactTouch: true,
      startTargetCount: 5,
      maxTargets: 12,
    });
  });

  test("initializes settings entity and resolves saved overrides", () => {
    const settingsEntity = createSettingsEntityFromSavedSettings(metrics, {
      compactTouch: {},
      desktop: {
        targetSpeed: 8,
        startLives: 6,
        maxLives: 4,
      },
    });

    expect(settingsEntity.settingsState.activeProfileKey).toBe("desktop");
    expect(settingsEntity.settingsState.draft.targetSpeed).toBe(8);
    expect(settingsEntity.settingsState.draft.startLives).toBe(4);
    expect(settingsEntity.settingsState.draft.maxLives).toBe(4);

    expect(resolveGameplayProfile(settingsEntity, metrics)).toMatchObject({
      compactTouch: false,
      targetSpeed: 8,
      startLives: 4,
      maxLives: 4,
    });
  });

  test("syncs active settings profile when device profile changes", () => {
    const settingsEntity: SettingsEntity = createSettingsEntityFromSavedSettings(metrics, {
      compactTouch: {
        maxTargets: 14,
      },
      desktop: {
        maxTargets: 22,
      },
    });

    expect(settingsEntity.settingsState.activeProfileKey).toBe("desktop");
    settingsEntity.settingsState.draft.maxTargets = 21;

    setPhoneDevice(true);
    syncSettingsStateWithProfile(settingsEntity, metrics);

    expect(settingsEntity.settingsState.activeProfileKey).toBe("compactTouch");
    expect(settingsEntity.settingsState.defaults.maxTargets).toBe(12);
    expect(settingsEntity.settingsState.draft.maxTargets).toBe(14);
  });
});
