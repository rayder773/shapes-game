export type GameEventType =
  | "game.round_started"
  | "game.round_paused"
  | "game.round_resumed"
  | "game.round_restarted"
  | "game.target_consumed"
  | "game.life_lost"
  | "game.life_collected"
  | "game.coin_collected"
  | "game.game_over";

export type GameEvent = {
  type: GameEventType;
  payload: Record<string, unknown>;
};

export type GameEventListener = (event: GameEvent) => void;

export type GameEventBus = {
  publish(event: GameEvent): void;
  subscribe(listener: GameEventListener): () => void;
};

export function createGameEventBus(): GameEventBus {
  const listeners = new Set<GameEventListener>();

  return {
    publish(event) {
      for (const listener of listeners) {
        listener(event);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
