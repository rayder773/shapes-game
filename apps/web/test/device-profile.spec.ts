import { describe, expect, test } from "vitest";
import {
  bootApp,
  gameModel,
  setDesktopDevice,
  setPhoneDevice,
} from "./helpers";

describe("device profile selection", () => {
  test("uses desktop profile defaults on desktop-like environment", async () => {
    setDesktopDevice();
    await bootApp("/shapes-game/");

    const state = gameModel();
    expect(state.gameplayProfile.compactTouch).toBe(false);
    expect(state.gameplayProfile.startTargetCount).toBe(9);
    expect(state.gameplayProfile.maxTargets).toBe(20);
  });

  test("uses compactTouch profile defaults on phone-like environment", async () => {
    setPhoneDevice();
    await bootApp("/shapes-game/");

    const state = gameModel();
    expect(state.gameplayProfile.compactTouch).toBe(true);
    expect(state.gameplayProfile.startTargetCount).toBe(5);
    expect(state.gameplayProfile.maxTargets).toBe(12);
  });
});
