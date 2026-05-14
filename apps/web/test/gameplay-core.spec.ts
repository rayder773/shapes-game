import { describe, expect, test } from "vitest";
import {
  advanceFrames,
  bootApp,
  click,
  gameModel,
  getPauseButton,
  getTertiaryOverlayButton,
  keydown,
  keyup,
  playerModel,
  pointerDownCanvasWorld,
  sceneEntities,
  setDeterministicRandom,
  targetModels,
} from "./helpers";

const DETERMINISTIC_WORLD_RANDOM = [0.13, 0.71, 0.29, 0.87, 0.41, 0.59, 0.17, 0.83, 0.37, 0.63, 0.23, 0.77];

async function chaseUntil(
  getTarget: () => { position: { x: number; y: number } } | undefined,
  predicate: () => boolean,
  maxSteps = 180,
) {
  for (let index = 0; index < maxSteps; index += 1) {
    if (predicate()) {
      return;
    }

    const target = getTarget();
    if (target) {
      const player = playerModel();

      if (player) {
        const deltaX = target.position.x - player.position.x;
        const deltaY = target.position.y - player.position.y;
        const distance = Math.hypot(deltaX, deltaY);
        const aimDistance = distance > 0 ? distance + 0.8 : 0.8;
        const aimX = player.position.x + (distance > 0 ? (deltaX / distance) * aimDistance : aimDistance);
        const aimY = player.position.y + (distance > 0 ? (deltaY / distance) * aimDistance : 0);
        pointerDownCanvasWorld(aimX, aimY);
      } else {
        pointerDownCanvasWorld(target.position.x, target.position.y);
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
  const player = state.scene.entities.find((entity) => entity.kind === "player");
  if (!player || !player.appearance || player.collisionRadius === undefined) {
    return undefined;
  }
  const playerAppearance = player.appearance;

  const targets = state.scene.entities.filter((entity) => entity.kind === "target" && entity.appearance && entity.collisionRadius !== undefined);

  return targets.find((target) => {
    const targetAppearance = target.appearance;
    if (!targetAppearance || !predicate(playerAppearance, targetAppearance)) {
      return false;
    }

    return !targets.some((other) => {
      if (other.id === target.id) {
        return false;
      }

      const distance = distancePointToSegment(other.position, player.position, target.position);
      return distance < player.collisionRadius! + other.collisionRadius! + 0.1;
    });
  });
}

async function restartUntilClearTarget(
  predicate: (player: NonNullable<AntiMatchTestSnapshot["entities"][number]["appearance"]>, target: NonNullable<AntiMatchTestSnapshot["entities"][number]["appearance"]>) => boolean,
  maxAttempts = 8,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const currentState = gameModel();
    const clearTarget = findClearTarget(currentState, predicate);
    if (clearTarget) {
      return clearTarget.id;
    }

    click(getPauseButton());
    click(getTertiaryOverlayButton());
    await advanceFrames(8);
  }

  expect(findClearTarget(gameModel(), predicate)).toBeDefined();
  return findClearTarget(gameModel(), predicate)!.id;
}

describe("gameplay core", () => {
  test("initial world state has one player and profile target count", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    await bootApp("/shapes-game/");

    const state = gameModel();
    expect(state.state).toBe("playing");
    expect(state.scene.entities.filter((entity) => entity.kind === "player")).toHaveLength(1);
    expect(state.scene.entities.filter((entity) => entity.kind === "target")).toHaveLength(state.gameplayProfile.startTargetCount);
    expect(state.scene.entities.filter((entity) => entity.kind === "lifePickup" || entity.kind === "coinPickup")).toHaveLength(0);
  });

  test("keyboard and pointer input update player direction and support boost", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    await bootApp("/shapes-game/");

    keydown("ArrowUp");
    let player = playerModel();
    expect(player?.movementDirection?.y).toBeGreaterThan(0);

    keydown("ArrowRight");
    player = playerModel();
    expect(player?.movementDirection?.x).toBeGreaterThan(0);
    expect(player?.movementDirection?.y).toBeGreaterThan(0);

    keyup("ArrowUp");
    keyup("ArrowRight");

    const currentPlayer = playerModel();
    pointerDownCanvasWorld(currentPlayer.position.x + 3, currentPlayer.position.y);
    const afterPointer = playerModel();
    expect(afterPointer.movementDirection!.x).toBeGreaterThan(0.9);

    const speedBeforeBoost = Math.hypot(afterPointer.movementDirection!.x, afterPointer.movementDirection!.y);
    pointerDownCanvasWorld(currentPlayer.position.x + 3, currentPlayer.position.y);
    await advanceFrames(1);
    const boosted = gameModel();
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

    const safeTargetId = await restartUntilClearTarget((player, target) => (
      target.shape !== player.shape
      && target.color !== player.color
      && target.fillStyle !== player.fillStyle
    ));
    const safeTarget = targetModels().find((target) => target.id === safeTargetId);
    expect(safeTarget).toBeDefined();
    const safeTargetAppearance = { ...safeTarget!.appearance! };
    setDeterministicRandom([0]);
    await chaseUntil(
      () => targetModels().find((target) => target.id === safeTargetId),
      () => gameModel().hud.score === 1,
      220,
    );

    const state = gameModel();
    expect(state.hud.score).toBe(1);
    expect(document.getElementById("hud-score")?.textContent).toBe("Счет: 1");
    expect(targetModels().find((target) => target.id === safeTargetId)).toBeUndefined();
    expect(playerModel().appearance).toMatchObject(safeTargetAppearance);
    expect(sceneEntities().filter((entity) => entity.kind === "lifePickup")).toHaveLength(1);
    expect(sceneEntities().filter((entity) => entity.kind === "coinPickup")).toHaveLength(1);
    const livesBeforeLifePickup = state.hud.lives;

    await chaseUntil(
      () => sceneEntities().find((entity) => entity.kind === "lifePickup"),
      () => sceneEntities().every((entity) => entity.kind !== "lifePickup") && gameModel().hud.lives === livesBeforeLifePickup + 1,
      220,
    );
    expect(gameModel().hud.lives).toBe(livesBeforeLifePickup + 1);

    await chaseUntil(
      () => sceneEntities().find((entity) => entity.kind === "coinPickup"),
      () => gameModel().hud.coins === 1,
      220,
    );
    expect(sceneEntities().filter((entity) => entity.kind === "coinPickup")).toHaveLength(0);
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

    const targetId = await restartUntilClearTarget((player, target) => (
      target.shape === player.shape
      || target.color === player.color
      || target.fillStyle === player.fillStyle
    ));
    const nextUnsafeTarget = targetModels().find((target) => target.id === targetId);
    expect(nextUnsafeTarget).toBeDefined();
    const state = gameModel();
    const livesBeforeHit = state.hud.lives;
    await chaseUntil(
      () => targetModels().find((target) => target.id === targetId),
      () => gameModel().hud.lives === livesBeforeHit - 1,
      220,
    );

    expect(gameModel().hud.lives).toBe(livesBeforeHit - 1);
    expect(targetModels().find((target) => target.id === targetId)).toBeUndefined();

    await advanceFrames(8);
    expect(gameModel().hud.lives).toBe(livesBeforeHit - 1);
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

    const state = gameModel();
    expect(state.gameplayProfile.targetGrowthScoreStep).toBe(0);
    expect(state.gameplayProfile.maxTargets).toBe(11);
  });
});
