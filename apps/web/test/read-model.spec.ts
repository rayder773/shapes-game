import { describe, expect, test } from "vitest";
import {
  acceptOnboarding,
  bootApp,
  click,
  gameModel,
  getPauseButton,
  playerModel,
  sceneEntities,
  settingsModel,
  targetModels,
} from "./helpers";

describe("game read model", () => {
  test("exposes stable scene entities with world positions", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    await bootApp("/shapes-game/");

    const first = gameModel();
    const second = gameModel();
    expect(second).toEqual(first);
    expect(first.hud.score).toEqual(expect.any(Number));
    expect(first.hud.coins).toEqual(expect.any(Number));
    expect(first.hud.lives).toEqual(expect.any(Number));
    expect(first.hud.maxLives).toEqual(expect.any(Number));
    expect(first.hud.bestScore === null || typeof first.hud.bestScore === "number").toBe(true);

    const player = playerModel();
    expect(player.kind).toBe("player");
    expect(player.appearance).toBeDefined();
    expect(player.collisionRadius).toEqual(expect.any(Number));

    expect(targetModels()).toHaveLength(first.gameplayProfile.startTargetCount);
    for (const entity of sceneEntities()) {
      expect(entity.id).toEqual(expect.any(Number));
      expect(entity.kind).toMatch(/^(player|target|lifePickup|coinPickup)$/);
      expect(entity.position.x).toEqual(expect.any(Number));
      expect(entity.position.y).toEqual(expect.any(Number));
      expect(entity.rotation).toEqual(expect.any(Number));
      expect(entity.appearance).toBeDefined();
    }
  });

  test("exposes overlay, HUD, round result and settings state", async () => {
    await bootApp("/shapes-game/");

    expect(gameModel().overlay.mode).toBe("onboarding");
    expect(gameModel().state).toBe("paused");

    acceptOnboarding();
    click(getPauseButton());

    const paused = gameModel();
    expect(paused.overlay.mode).toBe("pause");
    expect(paused.roundResult.baseScore).toEqual(expect.any(Number));
    expect(paused.roundResult.coinBonus).toEqual(expect.any(Number));
    expect(paused.roundResult.finalScore).toEqual(expect.any(Number));
    expect(paused.roundResult.bestScore === null || typeof paused.roundResult.bestScore === "number").toBe(true);
    expect(paused.roundResult.wasNewBest).toEqual(expect.any(Boolean));

    const settings = settingsModel();
    expect(settings).toEqual(paused.settings);
    expect(settings?.activeProfileKey).toBe("desktop");
    expect(settings?.draft.targetSpeed).toEqual(expect.any(Number));
    expect(settings?.defaults.maxLives).toEqual(expect.any(Number));
  });
});
