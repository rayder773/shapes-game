import {
  container,
  graphic,
  type PixiChild,
} from "../pixi-dsl";
import {
  PhysicsToPixi,
  PlanckPhysicsWorld,
  type PhysicsPoint,
  type PhysicsWorld,
} from "../physics";
import { ShapeObject, type ShapeKind } from "../objects/ShapeObject";
import { type GameFrame } from "./GameFrame";
import { PhysicsScene } from "./PhysicsScene";

const worldWidth = 960;
const worldHeight = 540;
const pixelsPerMeter = 48;
const physicsWidth = worldWidth / pixelsPerMeter;
const physicsHeight = worldHeight / pixelsPerMeter;
const objectCount = 10;

const shapeKinds: ShapeKind[] = [
  "circle",
  "square",
  "triangle",
];
const colors = [
  0xe84a5f,
  0x2f80ed,
  0x2fbf71,
];

export class GameScene {
  private readonly physicsScene: PhysicsScene;

  constructor() {
    const physics = new PlanckPhysicsWorld({
      gravity: {
        x: 0,
        y: 0,
      },
    });
    const transform = new PhysicsToPixi({
      origin: {
        x: worldWidth / 2,
        y: worldHeight / 2,
      },
      pixelsPerMeter,
    });

    this.physicsScene = new PhysicsScene({
      physics,
    });

    this.createWalls(physics);
    this.createObjects(physics, transform);
  }

  tick(frame: GameFrame): void {
    this.physicsScene.tick(frame);
  }

  view(): PixiChild {
    return container(
      this.worldBorder(),
      this.physicsScene.view(),
    )
      .background(0x10151f, {
        height: worldHeight,
        width: worldWidth,
      });
  }

  private createWalls(physics: PhysicsWorld): void {
    const wallThickness = 0.5;
    const halfWidth = physicsWidth / 2;
    const halfHeight = physicsHeight / 2;

    const walls = [
      {
        position: {
          x: 0,
          y: halfHeight + wallThickness / 2,
        },
        size: {
          height: wallThickness,
          width: physicsWidth + wallThickness * 2,
        },
      },
      {
        position: {
          x: 0,
          y: -halfHeight - wallThickness / 2,
        },
        size: {
          height: wallThickness,
          width: physicsWidth + wallThickness * 2,
        },
      },
      {
        position: {
          x: -halfWidth - wallThickness / 2,
          y: 0,
        },
        size: {
          height: physicsHeight + wallThickness * 2,
          width: wallThickness,
        },
      },
      {
        position: {
          x: halfWidth + wallThickness / 2,
          y: 0,
        },
        size: {
          height: physicsHeight + wallThickness * 2,
          width: wallThickness,
        },
      },
    ];

    for (const wall of walls) {
      physics.createBoxBody({
        friction: 0,
        position: wall.position,
        restitution: 1,
        size: wall.size,
        type: "static",
      });
    }
  }

  private createObjects(
    physics: PhysicsWorld,
    transform: PhysicsToPixi,
  ): void {
    const spawns: Array<{
      position: PhysicsPoint;
      radius: number;
    }> = [];

    for (let index = 0; index < objectCount; index += 1) {
      const radius = randomBetween(0.35, 0.65);
      const position = this.randomPosition(radius, spawns);
      const speed = randomBetween(1.4, 4.2);
      const direction = randomBetween(0, Math.PI * 2);

      spawns.push({
        position,
        radius,
      });

      this.physicsScene.add(new ShapeObject(physics, transform, {
        angularDamping: 0,
        angularVelocity: randomBetween(-2.5, 2.5),
        angle: randomBetween(0, Math.PI * 2),
        color: randomChoice(colors),
        friction: 0,
        kind: randomChoice(shapeKinds),
        linearVelocity: {
          x: Math.cos(direction) * speed,
          y: Math.sin(direction) * speed,
        },
        position,
        radius,
        restitution: 0.98,
      }));
    }
  }

  private randomPosition(
    radius: number,
    spawns: Array<{
      position: PhysicsPoint;
      radius: number;
    }>,
  ): PhysicsPoint {
    const halfWidth = physicsWidth / 2;
    const halfHeight = physicsHeight / 2;
    const padding = radius + 0.3;
    const maxAttempts = 80;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const position = {
        x: randomBetween(-halfWidth + padding, halfWidth - padding),
        y: randomBetween(-halfHeight + padding, halfHeight - padding),
      };

      if (this.isClearSpawn(position, radius, spawns)) {
        return position;
      }
    }

    return {
      x: randomBetween(-halfWidth + padding, halfWidth - padding),
      y: randomBetween(-halfHeight + padding, halfHeight - padding),
    };
  }

  private isClearSpawn(
    position: PhysicsPoint,
    radius: number,
    spawns: Array<{
      position: PhysicsPoint;
      radius: number;
    }>,
  ): boolean {
    return spawns.every((spawn) => {
      const dx = position.x - spawn.position.x;
      const dy = position.y - spawn.position.y;
      const minimumDistance = radius + spawn.radius + 0.2;

      return dx * dx + dy * dy >= minimumDistance * minimumDistance;
    });
  }

  private worldBorder(): PixiChild {
    return graphic()
      .draw((graphics) => {
        graphics
          .rect(1, 1, worldWidth - 2, worldHeight - 2)
          .stroke({
            alpha: 0.55,
            color: 0x5d6d7e,
            width: 2,
          });
      });
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
