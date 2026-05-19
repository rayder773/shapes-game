import {
  Box,
  Circle,
  Polygon,
  Vec2,
  World as PhysicsWorld,
  type Body,
  type BodyDef,
  type Contact,
  type FixtureDef,
  type Shape as PhysicsShape,
} from "planck";
import {
  clamp,
  getTriangleVertices,
  normalizeVector,
  WALL_THICKNESS,
} from "./game-geometry.ts";
import type {
  Bounds,
  ContactPassThroughPredicate,
  EntityId,
  PhysicsAdapter,
  PhysicsBodyId,
  PhysicsBodyKind,
  Shape,
} from "./game-runtime.ts";

type BodyUserData = {
  bodyId: PhysicsBodyId;
  kind: PhysicsBodyKind;
  entityId?: EntityId;
};

function getContactBodyIds(contact: Contact): { bodyIdA: PhysicsBodyId | null; bodyIdB: PhysicsBodyId | null } {
  const bodyIdA = (contact.getFixtureA().getBody().getUserData() as BodyUserData | undefined)?.bodyId ?? null;
  const bodyIdB = (contact.getFixtureB().getBody().getUserData() as BodyUserData | undefined)?.bodyId ?? null;
  return { bodyIdA, bodyIdB };
}

export function createPlanckPhysicsAdapter(): PhysicsAdapter {
  let world: PhysicsWorld | null = null;
  let nextBodyId = 1;
  let wallBodyIds: PhysicsBodyId[] = [];
  let queuedContacts: Array<{ bodyIdA: PhysicsBodyId; bodyIdB: PhysicsBodyId }> = [];
  let passThroughPredicate: ContactPassThroughPredicate | null = null;
  const bodies = new Map<PhysicsBodyId, Body>();

  function createShapeGeometry(shape: Shape, size: number): PhysicsShape {
    if (shape === "circle") return Circle(size);
    if (shape === "square") return Box(size, size);
    return Polygon(getTriangleVertices(size).map((vertex) => Vec2(vertex.x, vertex.y)));
  }

  function createFixtureOptions(shape: Shape, size: number): FixtureDef {
    return {
      shape: createShapeGeometry(shape, size),
      density: 1,
      friction: 0,
      restitution: 1,
    };
  }

  function clearFixtures(body: Body): void {
    for (let fixture = body.getFixtureList(); fixture; ) {
      const next = fixture.getNext();
      body.destroyFixture(fixture);
      fixture = next;
    }
  }

  function createWalls(bounds: Bounds): void {
    if (!world) return;

    const halfThickness = WALL_THICKNESS * 0.5;
    const wallDefs = [
      { x: bounds.width * 0.5, y: -halfThickness, hx: bounds.width * 0.5, hy: halfThickness },
      { x: bounds.width * 0.5, y: bounds.height + halfThickness, hx: bounds.width * 0.5, hy: halfThickness },
      { x: -halfThickness, y: bounds.height * 0.5, hx: halfThickness, hy: bounds.height * 0.5 },
      { x: bounds.width + halfThickness, y: bounds.height * 0.5, hx: halfThickness, hy: bounds.height * 0.5 },
    ];

    const currentWorld = world;

    wallBodyIds = wallDefs.map((wallDef) => {
      const bodyId = nextBodyId++;
      const bodyDefinition: BodyDef = {
        type: "static",
        position: Vec2(wallDef.x, wallDef.y),
        userData: { bodyId, kind: "wall" satisfies PhysicsBodyKind },
      };
      const body = currentWorld.createBody(bodyDefinition);

      body.createFixture({
        shape: Box(wallDef.hx, wallDef.hy),
        friction: 0,
        restitution: 1,
      });

      bodies.set(bodyId, body);
      return bodyId;
    });
  }

  function destroyWalls(): void {
    if (!world) return;

    for (const bodyId of wallBodyIds) {
      const body = bodies.get(bodyId);
      if (!body) continue;
      world.destroyBody(body);
      bodies.delete(bodyId);
    }

    wallBodyIds = [];
  }

  function shouldPassThroughContact(contact: Contact): boolean {
    if (!passThroughPredicate) return false;
    const { bodyIdA, bodyIdB } = getContactBodyIds(contact);
    if (bodyIdA === null || bodyIdB === null) return false;
    return passThroughPredicate(bodyIdA, bodyIdB);
  }

  return {
    createWorld(bounds) {
      world = new PhysicsWorld(Vec2(0, 0));
      nextBodyId = 1;
      wallBodyIds = [];
      queuedContacts = [];
      bodies.clear();

      world.on("begin-contact", (contact: Contact) => {
        const { bodyIdA, bodyIdB } = getContactBodyIds(contact);

        if (bodyIdA === null || bodyIdB === null) return;

        if (shouldPassThroughContact(contact)) {
          contact.setEnabled(false);
        }

        queuedContacts.push({ bodyIdA, bodyIdB });
      });

      world.on("pre-solve", (contact: Contact) => {
        if (shouldPassThroughContact(contact)) {
          contact.setEnabled(false);
        }
      });

      createWalls(bounds);
    },

    destroyWorld() {
      if (!world) return;

      for (const body of bodies.values()) {
        world.destroyBody(body);
      }

      bodies.clear();
      wallBodyIds = [];
      queuedContacts = [];
      world = null;
    },

    createDynamicBody(spec) {
      if (!world) {
        throw new Error("Physics world is not initialized");
      }

      const bodyId = nextBodyId++;
      const bodyDefinition: BodyDef = {
        type: "dynamic",
        position: Vec2(spec.position.x, spec.position.y),
        angle: spec.angle,
        linearDamping: spec.linearDamping,
        angularDamping: spec.angularDamping,
        bullet: spec.bullet,
        userData: { bodyId, kind: "entity" satisfies PhysicsBodyKind, entityId: spec.entityId },
      };
      const body = world.createBody(bodyDefinition);

      body.createFixture(createFixtureOptions(spec.shape, spec.size));
      body.setLinearVelocity(Vec2(spec.velocity.x, spec.velocity.y));
      body.setAngularVelocity(spec.angularVelocity);
      bodies.set(bodyId, body);
      return bodyId;
    },

    destroyBody(bodyId) {
      if (!world) return;
      const body = bodies.get(bodyId);
      if (!body) return;
      world.destroyBody(body);
      bodies.delete(bodyId);
    },

    setShape(bodyId, shapeSpec) {
      const body = bodies.get(bodyId);
      if (!body) return;
      clearFixtures(body);
      body.createFixture(createFixtureOptions(shapeSpec.shape, shapeSpec.size));
      body.resetMassData();
    },

    setVelocity(bodyId, velocity) {
      const body = bodies.get(bodyId);
      if (!body) return;
      body.setLinearVelocity(Vec2(velocity.x, velocity.y));
    },

    getVelocity(bodyId) {
      const body = bodies.get(bodyId);
      if (!body) return null;

      const velocity = body.getLinearVelocity();
      return { x: velocity.x, y: velocity.y };
    },

    setSpeedAlongDirection(bodyId, direction, speed) {
      const body = bodies.get(bodyId);
      const normalizedDirection = normalizeVector(direction);
      if (!body || !normalizedDirection) return;

      body.setLinearVelocity(Vec2(normalizedDirection.x * speed, normalizedDirection.y * speed));
    },

    setContactPassThroughPredicate(predicate) {
      passThroughPredicate = predicate;
    },

    step(dt) {
      world?.step(dt);
    },

    readTransform(bodyId) {
      const body = bodies.get(bodyId);
      if (!body) return null;

      const position = body.getPosition();
      return {
        x: position.x,
        y: position.y,
        angle: body.getAngle(),
      };
    },

    resizeBounds(bounds, dynamicBodies) {
      if (!world) return;

      destroyWalls();
      createWalls(bounds);

      for (const dynamicBody of dynamicBodies) {
        const body = bodies.get(dynamicBody.bodyId);
        if (!body) continue;

        const nextX = clamp(dynamicBody.x, dynamicBody.radius, bounds.width - dynamicBody.radius);
        const nextY = clamp(dynamicBody.y, dynamicBody.radius, bounds.height - dynamicBody.radius);
        body.setPosition(Vec2(nextX, nextY));
        body.setAwake(true);
      }
    },

    drainCollisionEvents() {
      const events = queuedContacts;
      queuedContacts = [];
      return events;
    },
  };
}
