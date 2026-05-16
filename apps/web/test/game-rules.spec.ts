import { describe, expect, test } from "vitest";
import {
  areAllPropertiesDifferent,
  collectPlayerCollisionEvent,
  getCollisionEventPairKey,
  resolveCollisionEvent,
  shouldPlayerContactPassThrough,
} from "../src/game/game-rules";
import type { Appearance } from "../src/game/game-runtime";

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

describe("game rules", () => {
  test("requires every appearance property to differ for safe target matches", () => {
    expect(areAllPropertiesDifferent(playerAppearance, safeTargetAppearance)).toBe(true);
    expect(areAllPropertiesDifferent(playerAppearance, unsafeTargetAppearance)).toBe(false);
  });

  test("classifies player collision participants into gameplay collision events", () => {
    expect(collectPlayerCollisionEvent({ id: 1, player: true }, { id: 2, target: true })).toEqual({
      type: "player-target",
      playerId: 1,
      targetId: 2,
    });
    expect(collectPlayerCollisionEvent({ id: 3, lifePickup: true }, { id: 1, player: true })).toEqual({
      type: "player-life",
      playerId: 1,
      lifeId: 3,
    });
    expect(collectPlayerCollisionEvent({ id: 1, player: true }, { id: 4, coinPickup: true })).toEqual({
      type: "player-coin",
      playerId: 1,
      coinId: 4,
    });
    expect(collectPlayerCollisionEvent({ id: 2, target: true }, { id: 4, coinPickup: true })).toBeNull();
  });

  test("generates stable collision pair keys for dedupe", () => {
    expect(getCollisionEventPairKey({ type: "player-target", playerId: 1, targetId: 2 })).toBe("1:2");
    expect(getCollisionEventPairKey({ type: "player-life", playerId: 1, lifeId: 3 })).toBe("1:life:3");
    expect(getCollisionEventPairKey({ type: "player-coin", playerId: 1, coinId: 4 })).toBe("1:coin:4");
  });

  test("resolves pickup collisions into collect commands without stopping", () => {
    expect(resolveCollisionEvent({
      collision: { type: "player-life", playerId: 1, lifeId: 3 },
    })).toEqual({
      command: { type: "collect-life", playerId: 1, lifeId: 3 },
      shouldStopResolving: false,
    });

    expect(resolveCollisionEvent({
      collision: { type: "player-coin", playerId: 1, coinId: 4 },
    })).toEqual({
      command: { type: "collect-coin", playerId: 1, coinId: 4 },
      shouldStopResolving: false,
    });
  });

  test("resolves target collisions into consume, lose-life, or game-over commands", () => {
    expect(resolveCollisionEvent({
      collision: { type: "player-target", playerId: 1, targetId: 2 },
      lives: 3,
      playerAppearance,
      targetAppearance: safeTargetAppearance,
    })).toEqual({
      command: { type: "consume-target", playerId: 1, targetId: 2 },
      shouldStopResolving: false,
    });

    expect(resolveCollisionEvent({
      collision: { type: "player-target", playerId: 1, targetId: 2 },
      lives: 2,
      playerAppearance,
      targetAppearance: unsafeTargetAppearance,
    })).toEqual({
      command: { type: "lose-life", playerId: 1, targetId: 2 },
      shouldStopResolving: true,
    });

    expect(resolveCollisionEvent({
      collision: { type: "player-target", playerId: 1, targetId: 2 },
      lives: 1,
      playerAppearance,
      targetAppearance: unsafeTargetAppearance,
    })).toEqual({
      command: { type: "game-over" },
      shouldStopResolving: true,
    });
  });

  test("decides when player contacts pass through physics", () => {
    expect(shouldPlayerContactPassThrough(null, false)).toBe(false);
    expect(shouldPlayerContactPassThrough({ target: true }, false)).toBe(true);
    expect(shouldPlayerContactPassThrough({ lifePickup: true }, false)).toBe(true);
    expect(shouldPlayerContactPassThrough({ coinPickup: true }, false)).toBe(true);
    expect(shouldPlayerContactPassThrough({}, false)).toBe(false);
    expect(shouldPlayerContactPassThrough({ target: true }, true)).toBe(true);
    expect(shouldPlayerContactPassThrough({ lifePickup: true }, true)).toBe(true);
    expect(shouldPlayerContactPassThrough({ coinPickup: true }, true)).toBe(true);
  });
});
