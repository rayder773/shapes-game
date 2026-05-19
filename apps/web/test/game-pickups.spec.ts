import { describe, expect, test } from "vitest";
import {
  collectExpiredPickups,
  createPickupLifetime,
  createPickupSpawnRequests,
} from "../src/game/game-pickups.ts";

describe("game pickups", () => {
  test("plans pickup spawn requests from independent chances", () => {
    expect(createPickupSpawnRequests({
      profile: { lifeSpawnChance: 0.5, coinSpawnChance: 0.4 },
      hasLifePickup: false,
      hasCoinPickup: false,
      random: {
        next: (() => {
          const values = [0.49, 0.39];
          return () => values.shift() ?? 1;
        })(),
      },
    })).toEqual([
      { type: "spawn-life" },
      { type: "spawn-coin" },
    ]);
  });

  test("does not plan duplicate pickups when they already exist", () => {
    expect(createPickupSpawnRequests({
      profile: { lifeSpawnChance: 1, coinSpawnChance: 1 },
      hasLifePickup: true,
      hasCoinPickup: true,
      random: { next: () => 0 },
    })).toEqual([]);
  });

  test("tracks life and coin lifetimes independently", () => {
    const life = { id: 1, pickupLifetime: createPickupLifetime(1) };
    const coin = { id: 2, pickupLifetime: createPickupLifetime(2) };

    expect(collectExpiredPickups([life, coin], 1)).toEqual([1]);
    expect(collectExpiredPickups([coin], 0.9)).toEqual([]);
    expect(collectExpiredPickups([coin], 0.1)).toEqual([2]);
  });
});
