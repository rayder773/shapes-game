import { describe, expect, test } from "vitest";
import {
  advanceUntil,
  bootApp,
  gameModel,
  playerModel,
  pointerDownCanvasWorld,
  setDeterministicRandom,
  targetModels,
} from "./helpers";

async function hitUnsafeTargetUntilResolved() {
  const state = gameModel();
  const player = playerModel();
  const target = targetModels().find((entity) =>
    entity.appearance!.shape === player.appearance!.shape
    || entity.appearance!.color === player.appearance!.color
    || entity.appearance!.fillStyle === player.appearance!.fillStyle,
  );

  expect(target).toBeDefined();
  const previousLives = state.hud.lives;
  pointerDownCanvasWorld(target!.position.x, target!.position.y);
  await advanceUntil(() => gameModel().hud.lives === Math.max(0, previousLives - 1) || gameModel().state === "gameOver", { maxFrames: 260 });
}

async function playUntilGameOver() {
  await hitUnsafeTargetUntilResolved();
  await hitUnsafeTargetUntilResolved();
  await hitUnsafeTargetUntilResolved();
  await advanceUntil(() => gameModel().state === "gameOver", { maxFrames: 260 });
  return gameModel();
}

describe("results and best score", () => {
  test("game over computes final score and persists existing best score", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    window.localStorage.setItem("shapes-game.bestScore", "2");
    setDeterministicRandom(new Array(400).fill(0));
    await bootApp("/shapes-game/");

    const state = await playUntilGameOver();
    expect(state.roundResult.baseScore).toBe(state.hud.score);
    expect(state.roundResult.coinBonus).toBe(state.hud.coins * 2);
    expect(state.roundResult.finalScore).toBe(state.hud.score + state.hud.coins * 2);
    expect(window.localStorage.getItem("shapes-game.bestScore")).toBe("2");
  });

  test("game over results overlay renders final round values", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    window.localStorage.setItem("shapes-game.bestScore", "2");
    setDeterministicRandom(new Array(400).fill(0));
    await bootApp("/shapes-game/");

    const state = await playUntilGameOver();
    expect(state.overlay.view).toMatchObject({
      title: "Результаты",
      buttons: [{ label: "Начать заново", action: "restart" }],
      results: {
        baseScore: state.roundResult.baseScore,
        coins: state.hud.coins,
        coinBonus: state.roundResult.coinBonus,
        finalScore: state.roundResult.finalScore,
        bestScore: state.roundResult.bestScore,
      },
    });
    expect(document.getElementById("overlay-title")?.textContent).toBe("Результаты");
    expect(document.getElementById("results-screen")?.hasAttribute("hidden")).toBe(false);
    expect(document.getElementById("results-base-value")?.textContent).toBe(String(state.roundResult.baseScore));
    expect(document.getElementById("results-coins-value")?.textContent).toBe(String(state.hud.coins));
    expect(document.getElementById("results-best-value")?.textContent).toBe(String(state.roundResult.bestScore));
    expect(document.getElementById("results-record-badge")?.hasAttribute("hidden")).toBe(true);
    expect(document.getElementById("overlay-secondary-button")?.hasAttribute("hidden")).toBe(true);
  });

  test("negative and invalid best score values do not break boot and new best is saved", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    window.localStorage.setItem("shapes-game.bestScore", "-4");
    setDeterministicRandom(new Array(400).fill(0));
    await bootApp("/shapes-game/");

    expect(document.getElementById("hud-best-value")?.textContent).toBe("0");

    const state = await playUntilGameOver();
    expect(state.roundResult.bestScore).toBe(state.roundResult.finalScore);
    expect(document.getElementById("results-best-value")?.textContent).toBe(String(state.roundResult.finalScore));
    expect(window.localStorage.getItem("shapes-game.bestScore")).toBe(String(state.roundResult.finalScore));
  });
});
