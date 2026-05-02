import { describe, expect, test } from "vitest";
import {
  advanceFrames,
  advanceUntil,
  bootApp,
  click,
  getPauseButton,
  getTertiaryOverlayButton,
  keydown,
  keyup,
  pointerDownCanvasWorld,
  setDeterministicRandom,
  snapshot,
} from "./helpers";

const DETERMINISTIC_WORLD_RANDOM = [0.13, 0.71, 0.29, 0.87, 0.41, 0.59, 0.17, 0.83, 0.37, 0.63, 0.23, 0.77];

async function chaseUntil(
  getTarget: () => { transform?: { x: number; y: number } } | undefined,
  predicate: () => boolean,
  maxSteps = 180,
) {
  for (let index = 0; index < maxSteps; index += 1) {
    if (predicate()) {
      return;
    }

    const target = getTarget();
    if (target?.transform) {
      const player = window.__ANTI_MATCH_TEST__?.getPlayer();

      if (player?.transform) {
        const deltaX = target.transform.x - player.transform.x;
        const deltaY = target.transform.y - player.transform.y;
        const distance = Math.hypot(deltaX, deltaY);
        const aimDistance = distance > 0 ? distance + 0.8 : 0.8;
        const aimX = player.transform.x + (distance > 0 ? (deltaX / distance) * aimDistance : aimDistance);
        const aimY = player.transform.y + (distance > 0 ? (deltaY / distance) * aimDistance : 0);
        pointerDownCanvasWorld(aimX, aimY);
      } else {
        pointerDownCanvasWorld(target.transform.x, target.transform.y);
      }
    }

    await advanceFrames(2);
  }

  expect(predicate()).toBe(true);
}

function distancePointToSegment(
  point: { x: number; y: number },
  segmentStart: { x: number; y: number },
  segmentEnd: { x: number; y: number },
) {
  const dx = segmentEnd.x - segmentStart.x;
  const dy = segmentEnd.y - segmentStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y);
  }

  const t = Math.max(0, Math.min(1, (
    ((point.x - segmentStart.x) * dx) + ((point.y - segmentStart.y) * dy)
  ) / lengthSquared));

  const projectionX = segmentStart.x + t * dx;
  const projectionY = segmentStart.y + t * dy;
  return Math.hypot(point.x - projectionX, point.y - projectionY);
}

function findClearTarget(
  state: AntiMatchTestSnapshot,
  predicate: (player: NonNullable<AntiMatchTestSnapshot["entities"][number]["appearance"]>, target: NonNullable<AntiMatchTestSnapshot["entities"][number]["appearance"]>) => boolean,
) {
  const player = state.entities.find((entity) => entity.player);
  if (!player?.transform || !player.appearance || !player.physics) {
    return undefined;
  }

  const targets = state.entities.filter((entity) => entity.target && entity.transform && entity.appearance && entity.physics);

  return targets.find((target) => {
    if (!predicate(player.appearance, target.appearance!)) {
      return false;
    }

    return !targets.some((other) => {
      if (other.id === target.id) {
        return false;
      }

      const distance = distancePointToSegment(other.transform!, player.transform!, target.transform!);
      return distance < player.physics!.radius + other.physics!.radius + 0.1;
    });
  });
}

async function restartUntilClearTarget(
  predicate: (player: NonNullable<AntiMatchTestSnapshot["entities"][number]["appearance"]>, target: NonNullable<AntiMatchTestSnapshot["entities"][number]["appearance"]>) => boolean,
  maxAttempts = 8,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const currentState = snapshot();
    const clearTarget = findClearTarget(currentState, predicate);
    if (clearTarget) {
      return clearTarget.id;
    }

    click(getPauseButton());
    click(getTertiaryOverlayButton());
    await advanceFrames(8);
  }

  expect(findClearTarget(snapshot(), predicate)).toBeDefined();
  return findClearTarget(snapshot(), predicate)!.id;
}

describe("gameplay core", () => {
  test("initial world state has one player and profile target count", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    await bootApp("/shapes-game/");

    const state = snapshot();
    expect(state.state).toBe("playing");
    expect(state.entities.filter((entity) => entity.player)).toHaveLength(1);
    expect(state.entities.filter((entity) => entity.target)).toHaveLength(state.gameplayProfile.startTargetCount);
    expect(state.entities.filter((entity) => entity.lifePickup || entity.coinPickup)).toHaveLength(0);
  });

  test("keyboard and pointer input update player direction and support boost", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    await bootApp("/shapes-game/");

    keydown("ArrowUp");
    let player = window.__ANTI_MATCH_TEST__!.getPlayer();
    expect(player?.movementDirection?.y).toBeGreaterThan(0);

    keydown("ArrowRight");
    player = window.__ANTI_MATCH_TEST__!.getPlayer();
    expect(player?.movementDirection?.x).toBeGreaterThan(0);
    expect(player?.movementDirection?.y).toBeGreaterThan(0);

    keyup("ArrowUp");
    keyup("ArrowRight");

    const currentPlayer = window.__ANTI_MATCH_TEST__!.getPlayer()!;
    pointerDownCanvasWorld(currentPlayer.transform!.x + 3, currentPlayer.transform!.y);
    const afterPointer = window.__ANTI_MATCH_TEST__!.getPlayer()!;
    expect(afterPointer.movementDirection!.x).toBeGreaterThan(0.9);

    const speedBeforeBoost = Math.hypot(afterPointer.movementDirection!.x, afterPointer.movementDirection!.y);
    pointerDownCanvasWorld(currentPlayer.transform!.x + 3, currentPlayer.transform!.y);
    await advanceFrames(1);
    const boosted = snapshot();
    expect(boosted.gameplayProfile.playerBoostSpeed).toBeGreaterThan(boosted.gameplayProfile.playerSpeed);
    expect(speedBeforeBoost).toBeCloseTo(1, 6);
  });

  test("safe target collision increases score and spawned pickups are collected", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    window.localStorage.setItem("shapes-game.gameplaySettings", JSON.stringify({
      compactTouch: {},
      desktop: {
        targetSpeed: 0,
        playerSpeed: 12,
        playerBoostSpeed: 18,
        maxTargets: 1,
        lifeSpawnChancePercent: 100,
      },
    }));
    setDeterministicRandom(DETERMINISTIC_WORLD_RANDOM);
    await bootApp("/shapes-game/");

    const api = window.__ANTI_MATCH_TEST__!;
    const safeTargetId = await restartUntilClearTarget((player, target) => (
      target.shape !== player.shape
      && target.color !== player.color
      && target.fillStyle !== player.fillStyle
    ));
    setDeterministicRandom([0]);
    await chaseUntil(
      () => api.getTargets().find((target) => target.id === safeTargetId),
      () => snapshot().score === 1,
      220,
    );

    let state = snapshot();
    expect(state.score).toBe(1);
    expect(document.getElementById("hud-score")?.textContent).toBe("Счет: 1");
    expect(api.getLifePickups()).toHaveLength(1);
    expect(api.getCoinPickups()).toHaveLength(1);
    const livesBeforeLifePickup = state.lives;

    await chaseUntil(
      () => api.getLifePickups()[0],
      () => api.getLifePickups().length === 0 && snapshot().lives === livesBeforeLifePickup + 1,
      220,
    );
    expect(snapshot().lives).toBe(livesBeforeLifePickup + 1);

    await chaseUntil(
      () => api.getCoinPickups()[0],
      () => snapshot().coins === 1,
      220,
    );
    expect(document.getElementById("hud-coins")?.dataset.pulse).toBe("true");
  });

  test("unsafe target collision decreases lives", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    window.localStorage.setItem("shapes-game.gameplaySettings", JSON.stringify({
      compactTouch: {},
      desktop: {
        targetSpeed: 0,
        playerSpeed: 12,
        playerBoostSpeed: 18,
        maxTargets: 1,
      },
    }));
    setDeterministicRandom(DETERMINISTIC_WORLD_RANDOM);
    await bootApp("/shapes-game/");

    const api = window.__ANTI_MATCH_TEST__!;
    const targetId = await restartUntilClearTarget((player, target) => (
      target.shape === player.shape
      || target.color === player.color
      || target.fillStyle === player.fillStyle
    ));
    const nextUnsafeTarget = api.getTargets().find((target) => target.id === targetId);
    expect(nextUnsafeTarget).toBeDefined();
    const state = snapshot();
    const livesBeforeHit = state.lives;
    await chaseUntil(
      () => api.getTargets().find((target) => target.id === targetId),
      () => snapshot().lives === livesBeforeHit - 1,
      220,
    );

    expect(snapshot().lives).toBe(livesBeforeHit - 1);
  });

  test("target growth respects fallback and maxTargets", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    window.localStorage.setItem("shapes-game.gameplaySettings", JSON.stringify({
      compactTouch: {},
      desktop: {
        targetGrowthScoreStep: 0,
        maxTargets: 11,
      },
    }));

    await bootApp("/shapes-game/");

    const state = snapshot();
    expect(state.gameplayProfile.targetGrowthScoreStep).toBe(0);
    expect(state.gameplayProfile.maxTargets).toBe(11);
  });
});
