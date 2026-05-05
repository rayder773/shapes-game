import { describe, expect, test } from "vitest";
import {
  advanceUntil,
  bootApp,
  pointerDownCanvasWorld,
  setDeterministicRandom,
  snapshot,
} from "./helpers";

async function hitUnsafeTargetUntilResolved() {
  const api = window.__ANTI_MATCH_TEST__!;
  const state = snapshot();
  const player = state.entities.find((entity) => entity.player)!;
  const target = api.getTargets().find((entity) =>
    entity.appearance!.shape === player.appearance!.shape
    || entity.appearance!.color === player.appearance!.color
    || entity.appearance!.fillStyle === player.appearance!.fillStyle,
  );

  expect(target).toBeDefined();
  const previousLives = state.lives;
  pointerDownCanvasWorld(target!.transform!.x, target!.transform!.y);
  await advanceUntil(() => snapshot().lives === Math.max(0, previousLives - 1) || snapshot().state === "gameOver", { maxFrames: 260 });
}

describe("results and best score", () => {
  test("game over computes final score, shows results overlay and persists best score", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    window.localStorage.setItem("shapes-game.bestScore", "2");
    setDeterministicRandom(new Array(400).fill(0));
    await bootApp("/shapes-game/");

    await hitUnsafeTargetUntilResolved();
    await hitUnsafeTargetUntilResolved();
    await hitUnsafeTargetUntilResolved();
    await advanceUntil(() => snapshot().state === "gameOver", { maxFrames: 260 });

    const state = snapshot();
    expect(state.lastRoundBaseScore).toBe(state.score);
    expect(state.lastRoundCoinBonus).toBe(state.coins * 2);
    expect(state.lastRoundFinalScore).toBe(state.score + state.coins * 2);
    expect(document.getElementById("overlay-title")?.textContent).toBe("Результаты");
    expect(document.getElementById("results-screen")?.hasAttribute("hidden")).toBe(false);
    expect(document.getElementById("results-base-value")?.textContent).toBe(String(state.lastRoundBaseScore));
    expect(document.getElementById("results-coins-value")?.textContent).toBe(String(state.coins));
    expect(document.getElementById("results-best-value")?.textContent).toBe(String(state.lastRoundBestScore));
    expect(document.getElementById("results-record-badge")?.hasAttribute("hidden")).toBe(true);
    expect(document.getElementById("overlay-secondary-button")?.hasAttribute("hidden")).toBe(true);
    expect(window.localStorage.getItem("shapes-game.bestScore")).toBe("2");
  });

  test("negative and invalid best score values do not break boot and new best is saved", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    window.localStorage.setItem("shapes-game.bestScore", "-4");
    setDeterministicRandom(new Array(400).fill(0));
    await bootApp("/shapes-game/");

    expect(document.getElementById("hud-best-value")?.textContent).toBe("0");

    await hitUnsafeTargetUntilResolved();
    await hitUnsafeTargetUntilResolved();
    await hitUnsafeTargetUntilResolved();
    await advanceUntil(() => snapshot().state === "gameOver", { maxFrames: 260 });

    const state = snapshot();
    expect(state.lastRoundBestScore).toBe(state.lastRoundFinalScore);
    expect(document.getElementById("results-best-value")?.textContent).toBe(String(state.lastRoundFinalScore));
    expect(window.localStorage.getItem("shapes-game.bestScore")).toBe(String(state.lastRoundFinalScore));
  });
});
