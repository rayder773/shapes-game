import {
  graphic,
  type PixiChild,
} from "../pixi-dsl";
import {
  type PhysicsPoint,
  type PhysicsSize,
  type PhysicsToPixi,
  type PhysicsWorld,
} from "../physics";
import { type WorldObject } from "../game/WorldObject";

type GroundObjectOptions = {
  color: number;
  friction: number;
  position: PhysicsPoint;
  size: PhysicsSize;
};

export class GroundObject implements WorldObject {
  private readonly options: GroundObjectOptions;
  private readonly transform: PhysicsToPixi;

  constructor(
    physics: PhysicsWorld,
    transform: PhysicsToPixi,
    options: GroundObjectOptions,
  ) {
    this.transform = transform;
    this.options = options;
    physics.createBoxBody({
      friction: options.friction,
      position: options.position,
      size: options.size,
      type: "static",
    });
  }

  syncFromPhysics(): void {}

  view(): PixiChild {
    return graphic()
      .draw((graphics) => {
        const rect = this.transform.rect(this.options.position, this.options.size);

        graphics
          .rect(rect.x, rect.y, rect.width, rect.height)
          .fill(this.options.color);
      });
  }
}
