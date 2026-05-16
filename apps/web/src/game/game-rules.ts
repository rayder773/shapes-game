import type {
  Appearance,
  CollisionEvent,
  EntityId,
  GameplayCommand,
} from "./game-runtime.ts";

export type CollisionParticipant = {
  id: EntityId;
  player?: true;
  target?: true;
  lifePickup?: true;
  coinPickup?: true;
};

export type TargetCollisionResolutionInput = {
  collision: Extract<CollisionEvent, { type: "player-target" }>;
  lives: number;
  playerAppearance: Appearance;
  targetAppearance: Appearance;
};

export type PickupCollisionResolutionInput = {
  collision: Exclude<CollisionEvent, { type: "player-target" }>;
};

export function areAllPropertiesDifferent(sourceAppearance: Appearance, targetAppearance: Appearance): boolean {
  return (
    sourceAppearance.shape !== targetAppearance.shape &&
    sourceAppearance.color !== targetAppearance.color &&
    sourceAppearance.fillStyle !== targetAppearance.fillStyle
  );
}

export function collectPlayerCollisionEvent(
  entityA: CollisionParticipant,
  entityB: CollisionParticipant,
): CollisionEvent | null {
  const playerEntity = entityA.player ? entityA : entityB.player ? entityB : null;
  if (!playerEntity) return null;

  const targetEntity = entityA.target ? entityA : entityB.target ? entityB : null;
  if (targetEntity) {
    return {
      type: "player-target",
      playerId: playerEntity.id,
      targetId: targetEntity.id,
    };
  }

  const lifeEntity = entityA.lifePickup ? entityA : entityB.lifePickup ? entityB : null;
  if (lifeEntity) {
    return {
      type: "player-life",
      playerId: playerEntity.id,
      lifeId: lifeEntity.id,
    };
  }

  const coinEntity = entityA.coinPickup ? entityA : entityB.coinPickup ? entityB : null;
  if (coinEntity) {
    return {
      type: "player-coin",
      playerId: playerEntity.id,
      coinId: coinEntity.id,
    };
  }

  return null;
}

export function getCollisionEventPairKey(collision: CollisionEvent): string {
  if (collision.type === "player-target") {
    return `${collision.playerId}:${collision.targetId}`;
  }

  if (collision.type === "player-life") {
    return `${collision.playerId}:life:${collision.lifeId}`;
  }

  return `${collision.playerId}:coin:${collision.coinId}`;
}

export function resolveCollisionEvent(
  input: TargetCollisionResolutionInput | PickupCollisionResolutionInput,
): { command: GameplayCommand; shouldStopResolving: boolean } {
  if (input.collision.type === "player-life") {
    return {
      command: {
        type: "collect-life",
        playerId: input.collision.playerId,
        lifeId: input.collision.lifeId,
      },
      shouldStopResolving: false,
    };
  }

  if (input.collision.type === "player-coin") {
    return {
      command: {
        type: "collect-coin",
        playerId: input.collision.playerId,
        coinId: input.collision.coinId,
      },
      shouldStopResolving: false,
    };
  }

  const targetInput = input as TargetCollisionResolutionInput;

  if (areAllPropertiesDifferent(targetInput.playerAppearance, targetInput.targetAppearance)) {
    return {
      command: {
        type: "consume-target",
        playerId: targetInput.collision.playerId,
        targetId: targetInput.collision.targetId,
      },
      shouldStopResolving: false,
    };
  }

  if (targetInput.lives > 1) {
    return {
      command: {
        type: "lose-life",
        playerId: targetInput.collision.playerId,
        targetId: targetInput.collision.targetId,
      },
      shouldStopResolving: true,
    };
  }

  return {
    command: { type: "game-over" },
    shouldStopResolving: true,
  };
}

export function shouldPlayerContactPassThrough(
  otherEntity: Pick<CollisionParticipant, "target" | "lifePickup" | "coinPickup"> | null,
  isDamageInvulnerable: boolean,
): boolean {
  if (!otherEntity) return false;

  if (isDamageInvulnerable) {
    return !!(otherEntity.target || otherEntity.lifePickup || otherEntity.coinPickup);
  }

  if (otherEntity.lifePickup || otherEntity.coinPickup) return true;
  return !!otherEntity.target;
}
