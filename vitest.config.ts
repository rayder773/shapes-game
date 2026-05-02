import { defineConfig } from "vitest/config";

function antiMatchTestHookPlugin() {
  return {
    name: "anti-match-test-hook",
    enforce: "post" as const,
    transform(code: string, id: string) {
      if (!id.endsWith("/src/game.ts")) {
        return null;
      }

      const hookSource = `
const __ANTI_MATCH_TEST_CLONE__ = (value) => {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
};

const __ANTI_MATCH_TEST_ENTITY__ = (entity) => ({
  id: entity.id,
  ...(entity.player ? { player: true } : {}),
  ...(entity.target ? { target: true } : {}),
  ...(entity.lifePickup ? { lifePickup: true } : {}),
  ...(entity.coinPickup ? { coinPickup: true } : {}),
  ...(entity.transform ? { transform: __ANTI_MATCH_TEST_CLONE__(entity.transform) } : {}),
  ...(entity.appearance ? { appearance: __ANTI_MATCH_TEST_CLONE__(entity.appearance) } : {}),
  ...(entity.movementDirection ? { movementDirection: __ANTI_MATCH_TEST_CLONE__(entity.movementDirection) } : {}),
  ...(entity.physics ? { physics: __ANTI_MATCH_TEST_CLONE__(entity.physics) } : {}),
});

const __ANTI_MATCH_TEST_COLLECT__ = (items) => items.map((entity) => __ANTI_MATCH_TEST_ENTITY__(entity));

const __ANTI_MATCH_TEST_SNAPSHOT__ = () => {
  const entities = [...game.queries.renderables]
    .map((entity) => __ANTI_MATCH_TEST_ENTITY__(entity))
    .sort((left, right) => left.id - right.id);

  return {
    state: game.state,
    score: game.score,
    coins: game.coins,
    lives: game.lives,
    maxLives: game.maxLives,
    bestScore: game.bestScore,
    lastRoundBaseScore: game.lastRoundBaseScore,
    lastRoundCoinBonus: game.lastRoundCoinBonus,
    lastRoundFinalScore: game.lastRoundFinalScore,
    lastRoundBestScore: game.lastRoundBestScore,
    lastGameOverWasNewBest: game.lastGameOverWasNewBest,
    gameplayProfile: __ANTI_MATCH_TEST_CLONE__(game.gameplayProfile),
    input: __ANTI_MATCH_TEST_CLONE__(game.input),
    entities,
  };
};

const __ANTI_MATCH_TEST_API__ = Object.freeze({
  snapshot: () => __ANTI_MATCH_TEST_SNAPSHOT__(),
  getPlayer: () => {
    const player = getPlayerEntity();
    return player ? __ANTI_MATCH_TEST_ENTITY__(player) : null;
  },
  getTargets: () => __ANTI_MATCH_TEST_COLLECT__([...game.queries.targets]),
  getLifePickups: () => __ANTI_MATCH_TEST_COLLECT__([...game.queries.lifePickups]),
  getCoinPickups: () => __ANTI_MATCH_TEST_COLLECT__([...game.queries.coinPickups]),
  getSettingsState: () => {
    const settingsEntity = getSettingsEntity();
    return settingsEntity ? __ANTI_MATCH_TEST_CLONE__(settingsEntity.settingsState) : null;
  },
});

Object.defineProperty(window, "__ANTI_MATCH_TEST__", {
  configurable: true,
  enumerable: false,
  writable: false,
  value: __ANTI_MATCH_TEST_API__,
});
`;

      return `${code}\n${hookSource}`;
    },
  };
}

export default defineConfig({
  base: "/shapes-game/",
  resolve: {
    alias: {
      "virtual:pwa-register": "/test/stubs/pwa-register.ts",
    },
  },
  plugins: [antiMatchTestHookPlugin()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
