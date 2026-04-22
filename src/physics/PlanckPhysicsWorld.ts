import { Box, Circle, type Body, World } from "planck";
import {
  type BoxBodyOptions,
  type CircleBodyOptions,
  type PhysicsBody,
  type PhysicsPoint,
  type PhysicsWorld,
} from "./types";

type PlanckPhysicsWorldOptions = {
  gravity: PhysicsPoint;
};

export class PlanckPhysicsWorld implements PhysicsWorld {
  private readonly world: World;

  constructor(options: PlanckPhysicsWorldOptions) {
    this.world = new World({
      gravity: options.gravity,
    });
  }

  createCircleBody(options: CircleBodyOptions): PhysicsBody {
    const body = this.world.createBody({
      angularDamping: options.angularDamping,
      linearVelocity: options.linearVelocity,
      position: options.position,
      type: options.type,
    });

    body.createFixture({
      density: options.density,
      friction: options.friction,
      restitution: options.restitution,
      shape: new Circle(options.radius),
    });

    return new PlanckPhysicsBody(body);
  }

  createBoxBody(options: BoxBodyOptions): PhysicsBody {
    const body = this.world.createBody({
      position: options.position,
      type: options.type,
    });

    body.createFixture({
      friction: options.friction,
      shape: new Box(options.size.width / 2, options.size.height / 2),
    });

    return new PlanckPhysicsBody(body);
  }

  step(deltaSeconds: number): void {
    this.world.step(deltaSeconds);
  }
}

class PlanckPhysicsBody implements PhysicsBody {
  constructor(private readonly body: Body) {}

  get angle(): number {
    return this.body.getAngle();
  }

  get position(): PhysicsPoint {
    const position = this.body.getPosition();

    return {
      x: position.x,
      y: position.y,
    };
  }

  setAngularVelocity(value: number): void {
    this.body.setAngularVelocity(value);
  }

  setLinearVelocity(velocity: PhysicsPoint): void {
    this.body.setLinearVelocity(velocity);
  }

  setTransform(position: PhysicsPoint, angle: number): void {
    this.body.setTransform(position, angle);
  }
}
