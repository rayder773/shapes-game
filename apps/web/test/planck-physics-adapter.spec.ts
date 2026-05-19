import { describe, expect, test } from "vitest";
import { createPlanckPhysicsAdapter } from "../src/game/planck-physics-adapter";
import type { DynamicBodySpec } from "../src/game/game-runtime";

function createDynamicBodySpec(overrides: Partial<DynamicBodySpec> = {}): DynamicBodySpec {
  return {
    entityId: 1,
    position: { x: 2, y: 2 },
    angle: 0,
    linearDamping: 0,
    angularDamping: 0,
    bullet: true,
    shape: "circle",
    size: 0.5,
    velocity: { x: 0, y: 0 },
    angularVelocity: 0,
    ...overrides,
  };
}

describe("planck physics adapter", () => {
  test("throws when creating a dynamic body before the world exists", () => {
    const adapter = createPlanckPhysicsAdapter();

    expect(() => adapter.createDynamicBody(createDynamicBodySpec())).toThrow("Physics world is not initialized");
  });

  test("creates, reads, and destroys dynamic bodies", () => {
    const adapter = createPlanckPhysicsAdapter();
    adapter.createWorld({ width: 10, height: 10 });

    const bodyId = adapter.createDynamicBody(createDynamicBodySpec({
      entityId: 7,
      position: { x: 3, y: 4 },
      angle: 0.25,
      shape: "square",
    }));

    expect(adapter.readTransform(bodyId)).toMatchObject({
      x: 3,
      y: 4,
      angle: 0.25,
    });

    adapter.destroyBody(bodyId);

    expect(adapter.readTransform(bodyId)).toBeNull();
  });

  test("sets velocity and normalizes speed along direction", () => {
    const adapter = createPlanckPhysicsAdapter();
    adapter.createWorld({ width: 10, height: 10 });
    const bodyId = adapter.createDynamicBody(createDynamicBodySpec());

    adapter.setVelocity(bodyId, { x: 3, y: -4 });
    expect(adapter.getVelocity(bodyId)).toEqual({ x: 3, y: -4 });

    adapter.setSpeedAlongDirection(bodyId, { x: 10, y: 0 }, 6);
    expect(adapter.getVelocity(bodyId)).toEqual({ x: 6, y: 0 });

    adapter.setSpeedAlongDirection(bodyId, { x: 3, y: 4 }, 10);
    const velocity = adapter.getVelocity(bodyId);
    expect(velocity?.x).toBeCloseTo(6, 6);
    expect(velocity?.y).toBeCloseTo(8, 6);

    adapter.setSpeedAlongDirection(bodyId, { x: 0, y: 0 }, 10);
    expect(adapter.getVelocity(bodyId)).toEqual({ x: 6, y: 8 });
  });

  test("resizes bounds by rebuilding walls and clamping dynamic bodies", () => {
    const adapter = createPlanckPhysicsAdapter();
    adapter.createWorld({ width: 10, height: 10 });
    const bodyId = adapter.createDynamicBody(createDynamicBodySpec({
      position: { x: 9, y: 9 },
    }));

    adapter.resizeBounds({ width: 5, height: 4 }, [
      {
        bodyId,
        radius: 0.5,
        x: 12,
        y: -2,
      },
    ]);

    expect(adapter.readTransform(bodyId)).toMatchObject({
      x: 4.5,
      y: 0.5,
    });
  });

  test("queues collision events and drains them once", () => {
    const adapter = createPlanckPhysicsAdapter();
    adapter.createWorld({ width: 10, height: 10 });
    const bodyIdA = adapter.createDynamicBody(createDynamicBodySpec({
      entityId: 1,
      position: { x: 3, y: 5 },
      velocity: { x: 2, y: 0 },
    }));
    const bodyIdB = adapter.createDynamicBody(createDynamicBodySpec({
      entityId: 2,
      position: { x: 7, y: 5 },
      velocity: { x: -2, y: 0 },
    }));

    let collisionEvents: Array<{ bodyIdA: number; bodyIdB: number }> = [];
    for (let index = 0; index < 180; index += 1) {
      adapter.step(1 / 60);
      collisionEvents = adapter.drainCollisionEvents();
      if (collisionEvents.some((event) => (
        (event.bodyIdA === bodyIdA && event.bodyIdB === bodyIdB)
        || (event.bodyIdA === bodyIdB && event.bodyIdB === bodyIdA)
      ))) {
        break;
      }
    }

    expect(collisionEvents.some((event) => (
      (event.bodyIdA === bodyIdA && event.bodyIdB === bodyIdB)
      || (event.bodyIdA === bodyIdB && event.bodyIdB === bodyIdA)
    ))).toBe(true);
    expect(adapter.drainCollisionEvents()).toEqual([]);
  });
});
