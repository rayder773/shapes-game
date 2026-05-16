import { describe, expect, test } from "vitest";
import { createRuntime, type CanvasMetrics, type GameplayProfile } from "../src/game-runtime";

function createTestGameplayProfile(_metrics: CanvasMetrics): GameplayProfile {
  return {
    compactTouch: false,
    startTargetCount: 9,
    minTargetsAfterScore: 10,
    targetSpeed: 2,
    playerSpeed: 5,
    playerBoostSpeed: 10,
    maxTargets: 20,
    targetGrowthScoreStep: 5,
    lifeSpawnChance: 0.15,
    coinSpawnChance: 0.15,
    startLives: 3,
    maxLives: 5,
    spawnPadding: 1.8,
    safeSpawnPadding: 2.3,
  };
}

function createTestRuntime() {
  return createRuntime({
    createGameplayProfile: createTestGameplayProfile,
    startRound: () => "round-1",
    now: () => 1234,
  });
}

describe("game runtime foundation", () => {
  test("creates boot runtime resources with default values", () => {
    const runtime = createTestRuntime();

    expect(runtime.state).toBe("boot");
    expect(runtime.score).toBe(0);
    expect(runtime.coins).toBe(0);
    expect(runtime.bestScore).toBeNull();
    expect(runtime.input).toEqual({
      up: false,
      down: false,
      left: false,
      right: false,
    });
    expect(runtime.queues).toEqual({
      physics: [],
      gameplay: [],
      spawns: [],
      collisionEvents: [],
    });
    expect(runtime.canvasMetrics).toEqual({
      dpr: 1,
      widthCss: 0,
      heightCss: 0,
      widthPx: 0,
      heightPx: 0,
    });
    expect(runtime.gameplayProfile).toMatchObject({
      compactTouch: false,
      startTargetCount: 9,
      maxTargets: 20,
    });
    expect(runtime.lives).toBe(3);
    expect(runtime.maxLives).toBe(5);
    expect(runtime.roundId).toBe("round-1");
    expect(runtime.roundStartedAt).toBe(1234);
  });

  test("wires ECS world and queries together", () => {
    const runtime = createTestRuntime();

    runtime.ecsWorld.add({
      id: 1,
      player: true,
      renderable: true,
      transform: { x: 2, y: 3, angle: 0 },
      appearance: { shape: "circle", color: "red", fillStyle: "filled", size: 0.55 },
      physics: { bodyId: 7, radius: 0.55 },
      movementDirection: { x: 1, y: 0 },
    });

    expect([...runtime.queries.players]).toHaveLength(1);
    expect([...runtime.queries.renderables]).toHaveLength(1);
    expect([...runtime.queries.physicsBodies]).toHaveLength(1);
  });

  test("does not share mutable resources between runtime instances", () => {
    const first = createTestRuntime();
    const second = createTestRuntime();

    first.input.up = true;
    first.queues.spawns.push({ type: "spawn-life" });
    first.ecsWorld.add({ id: 1 });

    expect(second.input.up).toBe(false);
    expect(second.queues.spawns).toHaveLength(0);
    expect([...second.ecsWorld.entities]).toHaveLength(0);
  });
});
