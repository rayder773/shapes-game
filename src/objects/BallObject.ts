import { Texture } from "pixi.js";
import {
  container,
  graphic,
  signal,
  sprite,
  type PixiChild,
  type Signal,
} from "../pixi-dsl";
import {
  type PhysicsBody,
  type PhysicsPoint,
  type PhysicsToPixi,
  type PhysicsWorld,
} from "../physics";
import { type WorldObject } from "../game/WorldObject";

type BallObjectOptions = {
  angularDamping: number;
  color: number;
  friction: number;
  highlightColor: number;
  linearVelocity: PhysicsPoint;
  position: PhysicsPoint;
  radius: number;
  restitution: number;
};

export class BallObject implements WorldObject {
  readonly height: Signal<number>;
  readonly position: Signal<PhysicsPoint>;
  readonly rotation: Signal<number>;
  private readonly body: PhysicsBody;
  private readonly options: BallObjectOptions;
  private readonly transform: PhysicsToPixi;

  constructor(
    physics: PhysicsWorld,
    transform: PhysicsToPixi,
    options: BallObjectOptions,
  ) {
    this.transform = transform;
    this.options = options;
    this.body = physics.createCircleBody({
      angularDamping: options.angularDamping,
      density: 1,
      friction: options.friction,
      linearVelocity: options.linearVelocity,
      position: options.position,
      radius: options.radius,
      restitution: options.restitution,
      type: "dynamic",
    });
    this.position = signal(this.transform.point(this.body.position));
    this.rotation = signal(this.transform.rotation(this.body.angle));
    this.height = signal(Math.max(this.body.position.y, 0));
  }

  syncFromPhysics(): void {
    const position = this.body.position;

    this.position.set(this.transform.point(position));
    this.rotation.set(this.transform.rotation(this.body.angle));
    this.height.set(Math.max(position.y, 0));
  }

  view(): PixiChild {
    const radius = this.transform.length(this.options.radius);

    return container(
      graphic()
        .draw((graphics) => {
          graphics
            .circle(0, 0, radius)
            .fill(this.options.color);
          graphics
            .circle(-radius * 0.3, -radius * 0.3, radius * 0.27)
            .fill(this.options.highlightColor);
        }),
      sprite(Texture.WHITE)
        .anchor(0.5)
        .size(radius * 1.4, 4)
        .tint(0x2f1e1b),
    )
      .position(this.position)
      .rotation(this.rotation);
  }
}
