import { describe, expect, test } from "vitest";
import {
  createSpawnAppearance,
  createSpawnRequests,
  findSpawnPosition,
  getDesiredTargetCount,
  type SpawnRandom,
} from "../src/game/game-spawn";
import type { Appearance, GameplayProfile } from "../src/game/game-runtime";

const profile: GameplayProfile = {
  compactTouch: false,
  startTargetCount: 3,
  minTargetsAfterScore: 4,
  targetSpeed: 2,
  playerSpeed: 5,
  playerBoostSpeed: 10,
  maxTargets: 6,
  targetGrowthScoreStep: 2,
  lifeSpawnChance: 0.15,
  coinSpawnChance: 0.15,
  startLives: 3,
  maxLives: 5,
  spawnPadding: 1.8,
  safeSpawnPadding: 2.3,
};

const playerAppearance: Appearance = {
  shape: "circle",
  color: "red",
  fillStyle: "filled",
  size: 0.55,
};

const safeTargetAppearance: Appearance = {
  shape: "square",
  color: "blue",
  fillStyle: "outline",
  size: 0.55,
};

const unsafeTargetAppearance: Appearance = {
  shape: "circle",
  color: "blue",
  fillStyle: "outline",
  size: 0.55,
};

function createRandom(options: {
  itemIndexes?: number[];
  rangeValues?: number[];
} = {}): SpawnRandom {
  const itemIndexes = [...(options.itemIndexes ?? [])];
  const rangeValues = [...(options.rangeValues ?? [])];

  return {
    item<T>(items: readonly T[]): T {
      const index = itemIndexes.shift() ?? 0;
      return items[index % items.length] as T;
    },
    range(min, max) {
      const value = rangeValues.shift();
      if (value !== undefined) return value;
      return min + (max - min) * 0.5;
    },
  };
}

describe("game spawn", () => {
  test("calculates desired target count from score and profile caps", () => {
    expect(getDesiredTargetCount(profile, 0)).toBe(3);
    expect(getDesiredTargetCount(profile, 1)).toBe(4);
    expect(getDesiredTargetCount(profile, 4)).toBe(6);
    expect(getDesiredTargetCount(profile, 20)).toBe(6);
    expect(getDesiredTargetCount({ ...profile, targetGrowthScoreStep: 0 }, 10)).toBe(4);
    expect(getDesiredTargetCount({ ...profile, startTargetCount: 10, maxTargets: 5 }, 0)).toBe(5);
  });

  test("creates target, safe target, life, and coin appearances", () => {
    expect(createSpawnAppearance("target", null, createRandom({
      itemIndexes: [1, 2, 1],
    }))).toEqual({
      shape: "square",
      color: "green",
      fillStyle: "outline",
      size: 0.55,
    });

    const safeAppearance = createSpawnAppearance("target", playerAppearance, createRandom({
      itemIndexes: [0, 0, 0],
    }));
    expect(safeAppearance.shape).not.toBe(playerAppearance.shape);
    expect(safeAppearance.color).not.toBe(playerAppearance.color);
    expect(safeAppearance.fillStyle).not.toBe(playerAppearance.fillStyle);
    expect(safeAppearance.size).toBe(0.55);

    expect(createSpawnAppearance("lifePickup", null, createRandom())).toEqual({
      shape: "square",
      color: "green",
      fillStyle: "outline",
      size: 0.42,
    });
    expect(createSpawnAppearance("coinPickup", null, createRandom())).toEqual({
      shape: "circle",
      color: "red",
      fillStyle: "outline",
      size: 0.4,
    });
  });

  test("plans target spawn requests and preserves safe target fallback", () => {
    expect(createSpawnRequests({
      profile,
      score: 0,
      currentTargetCount: 1,
      playerAppearance,
      targetAppearances: [safeTargetAppearance],
    })).toEqual([
      { type: "spawn-target", safeForPlayer: false },
      { type: "spawn-target", safeForPlayer: false },
    ]);

    expect(createSpawnRequests({
      profile,
      score: 0,
      currentTargetCount: 3,
      playerAppearance,
      targetAppearances: [unsafeTargetAppearance],
    })).toEqual([
      { type: "spawn-target", safeForPlayer: true, safeAppearance: playerAppearance },
    ]);

    expect(createSpawnRequests({
      profile,
      score: 0,
      currentTargetCount: 2,
      playerAppearance: null,
      targetAppearances: [],
    })).toEqual([
      { type: "spawn-target", safeForPlayer: false },
    ]);
  });

  test("finds a non-overlapping spawn position and falls back after blocked attempts", () => {
    const blockedThenFree = findSpawnPosition({
      bounds: { width: 10, height: 10 },
      blockers: [{ x: 2, y: 2, radius: 1 }],
      padding: 0.5,
      shape: "circle",
      size: 0.5,
      random: createRandom({
        rangeValues: [2, 2, 8, 8],
      }),
    });
    expect(blockedThenFree).toEqual({ x: 8, y: 8 });

    const fallbackValues = Array.from({ length: 160 }, () => 2);
    fallbackValues.push(7, 7);
    const fallback = findSpawnPosition({
      bounds: { width: 10, height: 10 },
      blockers: [{ x: 2, y: 2, radius: 5 }],
      padding: 0.5,
      shape: "circle",
      size: 0.5,
      random: createRandom({
        rangeValues: fallbackValues,
      }),
    });
    expect(fallback).toEqual({ x: 7, y: 7 });
  });
});
