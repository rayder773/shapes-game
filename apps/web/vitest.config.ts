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
const __ANTI_MATCH_TEST_API__ = Object.freeze({
  model: () => getGameReadModel(),
  snapshot: () => getGameReadModel(),
  getPlayer: () => getPlayerModel(),
  getTargets: () => getTargetModels(),
  getLifePickups: () => getLifePickupModels(),
  getCoinPickups: () => getCoinPickupModels(),
  getSettingsState: () => getSettingsReadModel(),
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
