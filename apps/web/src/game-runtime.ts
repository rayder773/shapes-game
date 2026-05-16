import { World as ECSWorld, type Query, type With } from "miniplex";
import type { Vec2Value } from "planck";
import type {
  GameplayProfileKey,
  GameplaySettingsValues,
  SavedGameplaySettings,
} from "./gameplay-settings.ts";
import type { PwaInlineInstallPrompt } from "./pwa.ts";

export type Shape = "circle" | "square" | "triangle";
export type ColorName = "red" | "blue" | "green";
export type FillStyleName = "filled" | "outline" | "dashed";
export type InputKey = "up" | "down" | "left" | "right";
export type PhysicsBodyKind = "entity" | "wall";
export type GameState = "boot" | "playing" | "paused" | "gameOver";
export type OverlayMode = "install" | "onboarding" | "pause" | "gameOver" | null;

export type EntityId = number;
export type PhysicsBodyId = number;

export type Transform = {
  x: number;
  y: number;
  angle: number;
};

export type Appearance = {
  shape: Shape;
  color: ColorName;
  fillStyle: FillStyleName;
  size: number;
};

export type PhysicsComponent = {
  bodyId: PhysicsBodyId;
  radius: number;
};

export type MovementDirection = {
  x: number;
  y: number;
};

export type GameplaySettingsState = {
  activeProfileKey: GameplayProfileKey;
  saved: SavedGameplaySettings;
  draft: GameplaySettingsValues;
  defaults: GameplaySettingsValues;
};

export type GameEntity = {
  id: EntityId;
  transform?: Transform;
  appearance?: Appearance;
  physics?: PhysicsComponent;
  movementDirection?: MovementDirection;
  renderable?: true;
  player?: true;
  target?: true;
  lifePickup?: true;
  coinPickup?: true;
  settingsState?: GameplaySettingsState;
};

export type InputSnapshot = Record<InputKey, boolean>;

export type CanvasMetrics = {
  dpr: number;
  widthCss: number;
  heightCss: number;
  widthPx: number;
  heightPx: number;
};

export type GameplayProfile = {
  compactTouch: boolean;
  startTargetCount: number;
  minTargetsAfterScore: number;
  targetSpeed: number;
  playerSpeed: number;
  playerBoostSpeed: number;
  maxTargets: number;
  targetGrowthScoreStep: number;
  lifeSpawnChance: number;
  coinSpawnChance: number;
  startLives: number;
  maxLives: number;
  spawnPadding: number;
  safeSpawnPadding: number;
};

export type PhysicsCommand = {
  type: "set-velocity";
  bodyId: PhysicsBodyId;
  velocity: Vec2Value;
};

export type GameplayCommand =
  | {
      type: "consume-target";
      playerId: EntityId;
      targetId: EntityId;
    }
  | {
      type: "lose-life";
      playerId: EntityId;
      targetId: EntityId;
    }
  | {
      type: "collect-life";
      playerId: EntityId;
      lifeId: EntityId;
    }
  | {
      type: "collect-coin";
      playerId: EntityId;
      coinId: EntityId;
    }
  | {
      type: "game-over";
    };

export type SpawnRequest =
  | {
      type: "spawn-target";
      safeForPlayer: boolean;
      safeAppearance?: Appearance;
    }
  | {
      type: "spawn-life";
    }
  | {
      type: "spawn-coin";
    };

export type CollisionEvent =
  | {
      type: "player-target";
      playerId: EntityId;
      targetId: EntityId;
    }
  | {
      type: "player-life";
      playerId: EntityId;
      lifeId: EntityId;
    }
  | {
      type: "player-coin";
      playerId: EntityId;
      coinId: EntityId;
    };

export type QueueState = {
  physics: PhysicsCommand[];
  gameplay: GameplayCommand[];
  spawns: SpawnRequest[];
  collisionEvents: CollisionEvent[];
};

export type PlayerEntity = With<GameEntity, "player" | "transform" | "appearance" | "physics" | "movementDirection">;
export type TargetEntity = With<GameEntity, "target" | "transform" | "appearance" | "physics" | "movementDirection">;
export type LifePickupEntity = With<GameEntity, "lifePickup" | "transform" | "appearance" | "physics" | "movementDirection">;
export type CoinPickupEntity = With<GameEntity, "coinPickup" | "transform" | "appearance" | "physics" | "movementDirection">;
export type PhysicsEntity = With<GameEntity, "transform" | "physics" | "movementDirection">;
export type RenderableEntity = With<GameEntity, "transform" | "appearance" | "renderable">;
export type ReadModelSourceEntity = With<GameEntity, "transform" | "appearance">;
export type AppearancePhysicsEntity = With<GameEntity, "appearance" | "physics" | "movementDirection">;
export type InteractiveEntity = With<GameEntity, "transform" | "appearance" | "physics" | "movementDirection">;
export type SettingsEntity = With<GameEntity, "settingsState">;

export type QuerySet = {
  players: Query<PlayerEntity>;
  targets: Query<TargetEntity>;
  lifePickups: Query<LifePickupEntity>;
  coinPickups: Query<CoinPickupEntity>;
  physicsBodies: Query<PhysicsEntity>;
  renderables: Query<RenderableEntity>;
  settings: Query<SettingsEntity>;
};

export type PlanckBodyUserData = {
  bodyId: PhysicsBodyId;
  kind: PhysicsBodyKind;
  entityId?: EntityId;
};

export type PhysicsBodySnapshot = {
  bodyId: PhysicsBodyId;
  radius: number;
  x: number;
  y: number;
};

export type Bounds = {
  width: number;
  height: number;
};

export type DynamicBodySpec = {
  entityId: EntityId;
  position: Vec2Value;
  angle: number;
  linearDamping: number;
  angularDamping: number;
  bullet: boolean;
  shape: Shape;
  size: number;
  velocity: Vec2Value;
  angularVelocity: number;
};

export type ContactPassThroughPredicate = (bodyIdA: PhysicsBodyId, bodyIdB: PhysicsBodyId) => boolean;

export type PhysicsAdapter = {
  createWorld(bounds: Bounds): void;
  destroyWorld(): void;
  createDynamicBody(spec: DynamicBodySpec): PhysicsBodyId;
  destroyBody(bodyId: PhysicsBodyId): void;
  setShape(bodyId: PhysicsBodyId, shapeSpec: { shape: Shape; size: number }): void;
  setVelocity(bodyId: PhysicsBodyId, velocity: Vec2Value): void;
  getVelocity(bodyId: PhysicsBodyId): Vec2Value | null;
  setSpeedAlongDirection(bodyId: PhysicsBodyId, direction: Vec2Value, speed: number): void;
  setContactPassThroughPredicate(predicate: ContactPassThroughPredicate | null): void;
  step(dt: number): void;
  readTransform(bodyId: PhysicsBodyId): Transform | null;
  resizeBounds(bounds: Bounds, dynamicBodies: PhysicsBodySnapshot[]): void;
  drainCollisionEvents(): Array<{ bodyIdA: PhysicsBodyId; bodyIdB: PhysicsBodyId }>;
};

export type Runtime = {
  state: GameState;
  score: number;
  coins: number;
  bestScore: number | null;
  lastGameOverWasNewBest: boolean;
  previousBestScoreBeforeGameOver: number | null;
  lastRoundBaseScore: number;
  lastRoundCoinBonus: number;
  lastRoundFinalScore: number;
  lastRoundBestScore: number | null;
  gameOverInstallPrompt: PwaInlineInstallPrompt | null;
  nextEntityId: number;
  accumulator: number;
  lastFrameTime: number;
  ecsWorld: ECSWorld<GameEntity>;
  queries: QuerySet;
  physicsAdapter: PhysicsAdapter | null;
  input: InputSnapshot;
  canvasMetrics: CanvasMetrics;
  gameplayProfile: GameplayProfile;
  queues: QueueState;
  playerBoostExpiresAt: number;
  lives: number;
  maxLives: number;
  damageInvulnerabilityExpiresAt: number;
  roundId: string;
  roundStartedAt: number;
};

export type RuntimeDependencies = {
  createGameplayProfile(metrics: CanvasMetrics): GameplayProfile;
  startRound(): string;
  now(): number;
};

export function createRuntime(dependencies: RuntimeDependencies): Runtime {
  const ecsWorld = new ECSWorld<GameEntity>();
  const canvasMetrics = createCanvasMetrics();

  return {
    state: "boot",
    score: 0,
    coins: 0,
    bestScore: null,
    lastGameOverWasNewBest: false,
    previousBestScoreBeforeGameOver: null,
    lastRoundBaseScore: 0,
    lastRoundCoinBonus: 0,
    lastRoundFinalScore: 0,
    lastRoundBestScore: null,
    gameOverInstallPrompt: null,
    nextEntityId: 1,
    accumulator: 0,
    lastFrameTime: 0,
    ecsWorld,
    queries: createQueries(ecsWorld),
    physicsAdapter: null,
    input: createInputSnapshot(),
    canvasMetrics,
    gameplayProfile: dependencies.createGameplayProfile(canvasMetrics),
    queues: createQueues(),
    playerBoostExpiresAt: 0,
    lives: 3,
    maxLives: 5,
    damageInvulnerabilityExpiresAt: 0,
    roundId: dependencies.startRound(),
    roundStartedAt: dependencies.now(),
  };
}

export function createQueries(ecsWorld: ECSWorld<GameEntity>): QuerySet {
  return {
    players: ecsWorld.with("player", "transform", "appearance", "physics", "movementDirection"),
    targets: ecsWorld.with("target", "transform", "appearance", "physics", "movementDirection"),
    lifePickups: ecsWorld.with("lifePickup", "transform", "appearance", "physics", "movementDirection"),
    coinPickups: ecsWorld.with("coinPickup", "transform", "appearance", "physics", "movementDirection"),
    physicsBodies: ecsWorld.with("transform", "physics", "movementDirection"),
    renderables: ecsWorld.with("transform", "appearance", "renderable"),
    settings: ecsWorld.with("settingsState"),
  };
}

export function createInputSnapshot(): InputSnapshot {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
  };
}

export function createCanvasMetrics(): CanvasMetrics {
  return {
    dpr: 1,
    widthCss: 0,
    heightCss: 0,
    widthPx: 0,
    heightPx: 0,
  };
}

export function createQueues(): QueueState {
  return {
    physics: [],
    gameplay: [],
    spawns: [],
    collisionEvents: [],
  };
}
