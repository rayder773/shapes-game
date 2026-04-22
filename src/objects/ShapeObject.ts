import { type Graphics } from "pixi.js";
import {
  container,
  graphic,
  signal,
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

export type ShapeKind = "circle" | "square" | "triangle";

type ShapeObjectOptions = {
  angularDamping: number;
  angularVelocity: number;
  angle: number;
  color: number;
  friction: number;
  kind: ShapeKind;
  linearVelocity: PhysicsPoint;
  position: PhysicsPoint;
  radius: number;
  restitution: number;
};

export class ShapeObject implements WorldObject {
  readonly position: Signal<PhysicsPoint>;
  readonly rotation: Signal<number>;
  private readonly body: PhysicsBody;
  private readonly options: ShapeObjectOptions;
  private readonly transform: PhysicsToPixi;

  constructor(
    physics: PhysicsWorld,
    transform: PhysicsToPixi,
    options: ShapeObjectOptions,
  ) {
    this.transform = transform;
    this.options = options;
    this.body = this.createBody(physics, options);
    this.position = signal(this.transform.point(this.body.position));
    this.rotation = signal(this.transform.rotation(this.body.angle));
  }

  syncFromPhysics(): void {
    this.position.set(this.transform.point(this.body.position));
    this.rotation.set(this.transform.rotation(this.body.angle));
  }

  view(): PixiChild {
    return container(graphic()
      .draw((graphics) => {
        this.drawShape(graphics);
      }))
      .position(this.position)
      .rotation(this.rotation);
  }

  private createBody(
    physics: PhysicsWorld,
    options: ShapeObjectOptions,
  ): PhysicsBody {
    const commonOptions = {
      angularDamping: options.angularDamping,
      angularVelocity: options.angularVelocity,
      angle: options.angle,
      density: 1,
      friction: options.friction,
      linearVelocity: options.linearVelocity,
      position: options.position,
      restitution: options.restitution,
      type: "dynamic" as const,
    };

    if (options.kind === "circle") {
      return physics.createCircleBody({
        ...commonOptions,
        radius: options.radius,
      });
    }

    if (options.kind === "square") {
      const side = options.radius * 2;

      return physics.createBoxBody({
        ...commonOptions,
        size: {
          height: side,
          width: side,
        },
      });
    }

    return physics.createPolygonBody({
      ...commonOptions,
      vertices: this.triangleVertices(options.radius),
    });
  }

  private drawShape(graphics: Graphics): void {
    const radius = this.transform.length(this.options.radius);

    if (this.options.kind === "circle") {
      graphics
        .circle(0, 0, radius)
        .fill(this.options.color);
      return;
    }

    if (this.options.kind === "square") {
      graphics
        .rect(-radius, -radius, radius * 2, radius * 2)
        .fill(this.options.color);
      return;
    }

    const height = radius * 1.8;
    const halfWidth = radius * 1.05;

    graphics
      .poly([
        0,
        -height / 2,
        halfWidth,
        height / 2,
        -halfWidth,
        height / 2,
      ])
      .fill(this.options.color);
  }

  private triangleVertices(radius: number): PhysicsPoint[] {
    const height = radius * 1.8;
    const halfWidth = radius * 1.05;

    return [
      {
        x: 0,
        y: height / 2,
      },
      {
        x: -halfWidth,
        y: -height / 2,
      },
      {
        x: halfWidth,
        y: -height / 2,
      },
    ];
  }
}
