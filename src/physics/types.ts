export type PhysicsPoint = {
  x: number;
  y: number;
};

export type PhysicsSize = {
  height: number;
  width: number;
};

export type PhysicsBodyKind = "dynamic" | "static";

export type PhysicsBody = {
  readonly angle: number;
  readonly position: PhysicsPoint;
  setAngularVelocity(value: number): void;
  setLinearVelocity(velocity: PhysicsPoint): void;
  setTransform(position: PhysicsPoint, angle: number): void;
};

export type CircleBodyOptions = {
  angularDamping?: number;
  density?: number;
  friction?: number;
  linearVelocity?: PhysicsPoint;
  position: PhysicsPoint;
  radius: number;
  restitution?: number;
  type: PhysicsBodyKind;
};

export type BoxBodyOptions = {
  friction?: number;
  position: PhysicsPoint;
  size: PhysicsSize;
  type: PhysicsBodyKind;
};

export type PhysicsWorld = {
  createBoxBody(options: BoxBodyOptions): PhysicsBody;
  createCircleBody(options: CircleBodyOptions): PhysicsBody;
  step(deltaSeconds: number): void;
};
