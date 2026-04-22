import { container, type PixiChild } from "../pixi-dsl";
import { type PhysicsWorld } from "../physics";
import { type GameFrame } from "./GameFrame";
import { type WorldObject } from "./WorldObject";

type PhysicsSceneOptions = {
  fixedTimeStep?: number;
  maxFrameTime?: number;
  physics: PhysicsWorld;
};

export class PhysicsScene {
  private readonly fixedTimeStep: number;
  private readonly maxFrameTime: number;
  private readonly objects: WorldObject[] = [];
  private readonly physics: PhysicsWorld;
  private accumulator = 0;

  constructor(options: PhysicsSceneOptions) {
    this.fixedTimeStep = options.fixedTimeStep ?? 1 / 60;
    this.maxFrameTime = options.maxFrameTime ?? 1 / 15;
    this.physics = options.physics;
  }

  add(object: WorldObject): void {
    this.objects.push(object);
    object.syncFromPhysics();
  }

  tick(frame: GameFrame): void {
    this.accumulator += Math.min(frame.deltaSeconds, this.maxFrameTime);

    while (this.accumulator >= this.fixedTimeStep) {
      this.physics.step(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
    }

    for (const object of this.objects) {
      object.syncFromPhysics();
    }
  }

  view(): PixiChild {
    return container(...this.objects.map((object) => object.view()));
  }
}
