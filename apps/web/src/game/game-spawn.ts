import {
  getShapeRadius,
  WALL_THICKNESS,
  type Vector2,
} from "./game-geometry.ts";
import { areAllPropertiesDifferent } from "./game-rules.ts";
import type {
  Appearance,
  Bounds,
  ColorName,
  FillStyleName,
  GameplayProfile,
  Shape,
  SpawnRequest,
} from "./game-runtime.ts";

export type SpawnRole = "player" | "target" | "lifePickup" | "coinPickup";

export type SpawnBlocker = {
  x: number;
  y: number;
  radius: number;
};

export type SpawnRandom = {
  item<T>(items: readonly T[]): T;
  range(min: number, max: number): number;
};

const ENTITY_SIZE = 0.55;
const LIFE_ENTITY_SIZE = 0.42;
const COIN_ENTITY_SIZE = 0.4;
const MAX_SPAWN_ATTEMPTS = 80;
const SHAPES: Shape[] = ["circle", "square", "triangle"];
const COLORS: ColorName[] = ["red", "blue", "green"];
const FILL_STYLES: FillStyleName[] = ["filled", "outline", "dashed"];

function chooseDifferent<T>(options: readonly T[], currentValue: T, random: SpawnRandom): T {
  return random.item(options.filter((value) => value !== currentValue));
}

export function createEntityAppearance(
  safeForAppearance: Appearance | null,
  random: SpawnRandom,
): Omit<Appearance, "size"> {
  if (!safeForAppearance) {
    return {
      shape: random.item(SHAPES),
      color: random.item(COLORS),
      fillStyle: random.item(FILL_STYLES),
    };
  }

  return {
    shape: chooseDifferent(SHAPES, safeForAppearance.shape, random),
    color: chooseDifferent(COLORS, safeForAppearance.color, random),
    fillStyle: chooseDifferent(FILL_STYLES, safeForAppearance.fillStyle, random),
  };
}

export function createSpawnAppearance(
  role: SpawnRole,
  safeForAppearance: Appearance | null,
  random: SpawnRandom,
): Appearance {
  if (role === "lifePickup") {
    return {
      shape: "square",
      color: "green",
      fillStyle: "outline",
      size: LIFE_ENTITY_SIZE,
    };
  }

  if (role === "coinPickup") {
    return {
      shape: "circle",
      color: "red",
      fillStyle: "outline",
      size: COIN_ENTITY_SIZE,
    };
  }

  return {
    ...createEntityAppearance(safeForAppearance, random),
    size: ENTITY_SIZE,
  };
}

export function getDesiredTargetCount(profile: GameplayProfile, score: number): number {
  const startTargetCount = Math.min(profile.startTargetCount, profile.maxTargets);
  const minTargetsAfterScore = Math.min(profile.minTargetsAfterScore, profile.maxTargets);

  if (score === 0) {
    return startTargetCount;
  }

  if (profile.targetGrowthScoreStep <= 0) {
    return minTargetsAfterScore;
  }

  return Math.min(
    minTargetsAfterScore + Math.floor(score / profile.targetGrowthScoreStep),
    profile.maxTargets,
  );
}

export function createSpawnRequests(options: {
  profile: GameplayProfile;
  score: number;
  currentTargetCount: number;
  playerAppearance: Appearance | null;
  targetAppearances: Appearance[];
}): SpawnRequest[] {
  const requests: SpawnRequest[] = [];
  const desiredTargetCount = getDesiredTargetCount(options.profile, options.score);

  for (let count = options.currentTargetCount; count < desiredTargetCount; count += 1) {
    requests.push({
      type: "spawn-target",
      safeForPlayer: false,
    });
  }

  if (!options.playerAppearance) {
    return requests;
  }

  const playerAppearance = options.playerAppearance;
  const hasSafeTarget = options.targetAppearances.some((targetAppearance) => (
    areAllPropertiesDifferent(playerAppearance, targetAppearance)
  ));

  if (!hasSafeTarget) {
    requests.push({
      type: "spawn-target",
      safeForPlayer: true,
      safeAppearance: options.playerAppearance,
    });
  }

  return requests;
}

export function findSpawnPosition(options: {
  bounds: Bounds;
  blockers: SpawnBlocker[];
  padding: number;
  shape: Shape;
  size: number;
  random: Pick<SpawnRandom, "range">;
}): Vector2 {
  const radius = getShapeRadius(options.shape, options.size);
  const minX = radius + WALL_THICKNESS + 0.2;
  const maxX = options.bounds.width - radius - WALL_THICKNESS - 0.2;
  const minY = radius + WALL_THICKNESS + 0.2;
  const maxY = options.bounds.height - radius - WALL_THICKNESS - 0.2;

  for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt += 1) {
    const candidate = {
      x: options.random.range(minX, Math.max(minX, maxX)),
      y: options.random.range(minY, Math.max(minY, maxY)),
    };
    let overlaps = false;

    for (const other of options.blockers) {
      const distance = Math.hypot(candidate.x - other.x, candidate.y - other.y);
      const minDistance = radius + other.radius + options.padding;

      if (distance < minDistance) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      return candidate;
    }
  }

  return {
    x: options.random.range(minX, Math.max(minX, maxX)),
    y: options.random.range(minY, Math.max(minY, maxY)),
  };
}
