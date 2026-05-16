import { describe, expect, test } from "vitest";
import { buildAppReadModel } from "../src/app/app-read-model-builder.ts";
import {
  buildGameReadModel,
  type GameReadModelRuntime,
} from "../src/game/game-read-model-builder.ts";
import type { GameReadModelSettings } from "../src/game/game-read-model.ts";
import type { ReadModelSourceEntity } from "../src/game/game-runtime.ts";

const rules = ["Rule one", "Rule two"];

function createEntity(
  overrides: Partial<ReadModelSourceEntity> & Pick<ReadModelSourceEntity, "id">,
): ReadModelSourceEntity {
  return {
    transform: {
      x: 1,
      y: 2,
      angle: 0.5,
    },
    appearance: {
      shape: "circle",
      color: "red",
      fillStyle: "filled",
      size: 0.55,
    },
    movementDirection: {
      x: 0,
      y: 1,
    },
    physics: {
      bodyId: overrides.id,
      radius: 0.55,
    },
    ...overrides,
  } as ReadModelSourceEntity;
}

function createSettings(): GameReadModelSettings {
  return {
    activeProfileKey: "desktop",
    saved: {
      compactTouch: {},
      desktop: {
        targetSpeed: 4,
      },
    },
    draft: {
      targetSpeed: 4,
      playerSpeed: 5,
      playerBoostSpeed: 8,
      maxTargets: 7,
      targetGrowthScoreStep: 3,
      lifeSpawnChancePercent: 15,
      startLives: 3,
      maxLives: 5,
    },
    defaults: {
      targetSpeed: 3,
      playerSpeed: 4,
      playerBoostSpeed: 7,
      maxTargets: 6,
      targetGrowthScoreStep: 2,
      lifeSpawnChancePercent: 10,
      startLives: 3,
      maxLives: 5,
    },
  };
}

function createRuntime(overrides: Partial<GameReadModelRuntime> = {}): GameReadModelRuntime {
  const entities = [
    createEntity({ id: 3, target: true, transform: { x: 9, y: 8, angle: 0.3 } }),
    createEntity({ id: 1, player: true, transform: { x: 4, y: 5, angle: 0.1 } }),
  ];

  return {
    state: "playing",
    score: 12,
    coins: 2,
    bestScore: 20,
    lives: 2,
    maxLives: 5,
    lastRoundBaseScore: 12,
    lastRoundCoinBonus: 4,
    lastRoundFinalScore: 16,
    lastRoundBestScore: 20,
    lastGameOverWasNewBest: false,
    gameplayProfile: {
      compactTouch: false,
      startTargetCount: 2,
      minTargetsAfterScore: 2,
      targetSpeed: 3,
      playerSpeed: 4,
      playerBoostSpeed: 7,
      maxTargets: 8,
      targetGrowthScoreStep: 2,
      lifeSpawnChance: 0.1,
      coinSpawnChance: 0.2,
      startLives: 3,
      maxLives: 5,
      spawnPadding: 1,
      safeSpawnPadding: 2,
    },
    input: {
      up: true,
      down: false,
      left: false,
      right: true,
    },
    gameOverInstallPrompt: null,
    queries: {
      renderables: entities,
    },
    ...overrides,
  };
}

function createModel(overrides: Partial<GameReadModelRuntime> = {}) {
  return buildGameReadModel({
    runtime: createRuntime(overrides),
    settings: createSettings(),
    overlay: {
      mode: null,
      rules,
      lastPauseWasAutoPaused: false,
      activeInstallOverlay: null,
      pauseInstallButton: {
        visible: false,
        label: "Install",
      },
    },
  });
}

describe("read model builder", () => {
  test("maps runtime state to a stable game read model", () => {
    const model = createModel();

    expect(model.hud).toEqual({
      score: 12,
      coins: 2,
      lives: 2,
      maxLives: 5,
      bestScore: 20,
    });
    expect(model.roundResult).toEqual({
      baseScore: 12,
      coinBonus: 4,
      finalScore: 16,
      bestScore: 20,
      wasNewBest: false,
    });
    expect(model.settings).toEqual(createSettings());
    expect(model.gameplayProfile.maxTargets).toBe(8);
    expect(model.input).toEqual({
      up: true,
      down: false,
      left: false,
      right: true,
    });
  });

  test("maps and sorts scene entities without exposing ECS component names", () => {
    const model = createModel();

    expect(model.scene.entities.map((entity) => entity.id)).toEqual([1, 3]);
    expect(model.scene.entities[0]).toMatchObject({
      id: 1,
      kind: "player",
      position: {
        x: 4,
        y: 5,
      },
      rotation: 0.1,
      appearance: {
        shape: "circle",
        color: "red",
        fillStyle: "filled",
        size: 0.55,
      },
      movementDirection: {
        x: 0,
        y: 1,
      },
      collisionRadius: 0.55,
    });
    expect(model.scene.entities[0]).not.toHaveProperty("transform");
    expect(model.scene.entities[0]).not.toHaveProperty("physics");
    expect(model.scene.entities[0]).not.toHaveProperty("player");
  });

  test("builds onboarding and pause overlay views", () => {
    const runtime = createRuntime();

    const onboarding = buildGameReadModel({
      runtime,
      settings: null,
      overlay: {
        mode: "onboarding",
        rules,
        lastPauseWasAutoPaused: false,
        activeInstallOverlay: null,
        pauseInstallButton: {
          visible: false,
          label: "Install",
        },
      },
    });
    expect(onboarding.overlay.view).toMatchObject({
      title: "Правила",
      tips: rules,
      buttons: [{ label: "Понятно", action: "acceptOnboarding" }],
    });

    const paused = buildGameReadModel({
      runtime,
      settings: null,
      overlay: {
        mode: "pause",
        rules,
        lastPauseWasAutoPaused: true,
        activeInstallOverlay: null,
        pauseInstallButton: {
          visible: true,
          label: "Install app",
        },
      },
    });
    expect(paused.overlay.view).toMatchObject({
      title: "Пауза",
      message: "Игра остановлена.",
      installButton: { label: "Install app", surface: "pause" },
      buttons: [
        { label: "Продолжить", action: "resume" },
        { label: "Настройки", action: "openSettings" },
        { label: "Начать заново", action: "restart" },
      ],
    });
  });

  test("builds game over and install overlay views", () => {
    const gameOver = buildGameReadModel({
      runtime: createRuntime({
        coins: 3,
        lastRoundBaseScore: 9,
        lastRoundCoinBonus: 6,
        lastRoundFinalScore: 15,
        lastRoundBestScore: null,
        lastGameOverWasNewBest: true,
        gameOverInstallPrompt: {
          message: "Install after the round",
          buttonLabel: "Install",
        },
      }),
      settings: null,
      overlay: {
        mode: "gameOver",
        rules,
        lastPauseWasAutoPaused: false,
        activeInstallOverlay: null,
        pauseInstallButton: {
          visible: false,
          label: "Install",
        },
      },
    });

    expect(gameOver.overlay.view).toMatchObject({
      variant: "results-record",
      footerPrompt: {
        message: "Install after the round",
        button: { label: "Install", action: "confirmInstall" },
      },
      results: {
        baseScore: 9,
        coins: 3,
        coinBonus: 6,
        finalScore: 15,
        bestScore: 15,
        wasNewBest: true,
      },
    });

    const install = buildGameReadModel({
      runtime: createRuntime(),
      settings: null,
      overlay: {
        mode: "install",
        rules,
        lastPauseWasAutoPaused: false,
        activeInstallOverlay: {
          variant: "prompt",
          surface: "postGameOver",
          title: "AntiMatch",
          message: "Install message",
          tips: ["Tip"],
          primaryLabel: "Install",
          secondaryLabel: "Later",
        },
        pauseInstallButton: {
          visible: false,
          label: "Install",
        },
      },
    });

    expect(install.overlay.view).toMatchObject({
      layout: "sheet",
      variant: "default",
      title: "AntiMatch",
      message: "Install message",
      tips: ["Tip"],
      buttons: [
        { label: "Install", action: "confirmInstall" },
        { label: "Later", action: "dismissInstall" },
      ],
    });
  });

  test("builds app shell visibility from route", () => {
    const game = createModel();

    expect(buildAppReadModel("game", game).shell).toEqual({
      gamePageVisible: true,
      settingsPageVisible: false,
      adminPageVisible: false,
    });
    expect(buildAppReadModel("settings", game).shell).toEqual({
      gamePageVisible: false,
      settingsPageVisible: true,
      adminPageVisible: false,
    });
    expect(buildAppReadModel("admin", game).shell).toEqual({
      gamePageVisible: false,
      settingsPageVisible: false,
      adminPageVisible: true,
    });
  });
});
