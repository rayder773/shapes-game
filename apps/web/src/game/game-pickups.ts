import type {
  EntityId,
  GameplayProfile,
  PickupLifetime,
  SpawnRequest,
} from "./game-runtime.ts";

export type PickupSpawnRandom = {
  next(): number;
};

export type PickupLifetimeEntity = {
  id: EntityId;
  pickupLifetime?: PickupLifetime;
};

export function createPickupLifetime(durationSeconds: number): PickupLifetime {
  return {
    elapsedSeconds: 0,
    durationSeconds,
  };
}

export function createPickupSpawnRequests(options: {
  profile: Pick<GameplayProfile, "lifeSpawnChance" | "coinSpawnChance">;
  hasLifePickup: boolean;
  hasCoinPickup: boolean;
  random: PickupSpawnRandom;
}): SpawnRequest[] {
  const requests: SpawnRequest[] = [];

  if (!options.hasLifePickup && options.random.next() < options.profile.lifeSpawnChance) {
    requests.push({ type: "spawn-life" });
  }

  if (!options.hasCoinPickup && options.random.next() < options.profile.coinSpawnChance) {
    requests.push({ type: "spawn-coin" });
  }

  return requests;
}

export function collectExpiredPickups(
  pickups: Iterable<PickupLifetimeEntity>,
  deltaSeconds: number,
): EntityId[] {
  const expiredIds: EntityId[] = [];

  for (const pickup of pickups) {
    if (!pickup.pickupLifetime) continue;

    pickup.pickupLifetime.elapsedSeconds += deltaSeconds;

    if (pickup.pickupLifetime.elapsedSeconds >= pickup.pickupLifetime.durationSeconds) {
      expiredIds.push(pickup.id);
    }
  }

  return expiredIds;
}
