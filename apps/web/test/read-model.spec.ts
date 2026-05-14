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
  test("exposes stable scene entities with world positions and legacy compatibility", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    await bootApp("/shapes-game/");

    const first = gameModel();
    const second = gameModel();
    expect(second).toEqual(first);

    expect(first.scene.entities).toEqual(first.entities);
    expect(first.hud).toEqual({
      score: first.score,
      coins: first.coins,
      lives: first.lives,
      maxLives: first.maxLives,
      bestScore: first.bestScore,
    });

    const player = playerModel();
    expect(player.kind).toBe("player");
    expect(player.player).toBe(true);
    expect(player.transform).toEqual({
      x: player.position.x,
      y: player.position.y,
      angle: player.rotation,
    });
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
    expect(paused.roundResult).toEqual({
      baseScore: paused.lastRoundBaseScore,
      coinBonus: paused.lastRoundCoinBonus,
      finalScore: paused.lastRoundFinalScore,
      bestScore: paused.lastRoundBestScore,
      wasNewBest: paused.lastGameOverWasNewBest,
    });

    const settings = settingsModel();
    expect(settings).toEqual(paused.settings);
    expect(settings?.activeProfileKey).toBe("desktop");
    expect(settings?.draft.targetSpeed).toEqual(expect.any(Number));
    expect(settings?.defaults.maxLives).toEqual(expect.any(Number));
  });
});
