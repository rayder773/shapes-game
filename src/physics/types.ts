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
  angularVelocity?: number;
  angle?: number;
  density?: number;
  friction?: number;
  linearVelocity?: PhysicsPoint;
  position: PhysicsPoint;
  radius: number;
  restitution?: number;
  type: PhysicsBodyKind;
};

export type BoxBodyOptions = {
  angularDamping?: number;
  angularVelocity?: number;
  angle?: number;
  density?: number;
  friction?: number;
  linearVelocity?: PhysicsPoint;
  position: PhysicsPoint;
  restitution?: number;
  size: PhysicsSize;
  type: PhysicsBodyKind;
};

export type PolygonBodyOptions = {
  angularDamping?: number;
  angularVelocity?: number;
  angle?: number;
  density?: number;
  friction?: number;
  linearVelocity?: PhysicsPoint;
  position: PhysicsPoint;
  restitution?: number;
  type: PhysicsBodyKind;
  vertices: PhysicsPoint[];
};

export type PhysicsWorld = {
  createBoxBody(options: BoxBodyOptions): PhysicsBody;
  createCircleBody(options: CircleBodyOptions): PhysicsBody;
  createPolygonBody(options: PolygonBodyOptions): PhysicsBody;
  step(deltaSeconds: number): void;
};
