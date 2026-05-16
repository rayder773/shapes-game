import {
  createPwaOverlayViewModel,
  type PwaInstallOverlayModel,
} from "../platform/pwa.ts";
import type {
  GameReadModel,
  GameReadModelEntity,
  GameReadModelEntityKind,
  GameReadModelOverlayView,
  GameReadModelSettings,
} from "./game-read-model.ts";
import type {
  OverlayMode,
  ReadModelSourceEntity,
  Runtime,
  SettingsEntity,
} from "./game-runtime.ts";

export type GameReadModelRuntime = Pick<
  Runtime,
  | "state"
  | "score"
  | "coins"
  | "bestScore"
  | "lives"
  | "maxLives"
  | "lastRoundBaseScore"
  | "lastRoundCoinBonus"
  | "lastRoundFinalScore"
  | "lastRoundBestScore"
  | "lastGameOverWasNewBest"
  | "gameplayProfile"
  | "input"
  | "gameOverInstallPrompt"
> & {
  queries: {
    renderables: Iterable<ReadModelSourceEntity>;
  };
};

export type GameReadModelOverlayContext = {
  mode: OverlayMode;
  rules: string[];
  lastPauseWasAutoPaused: boolean;
  activeInstallOverlay: PwaInstallOverlayModel | null;
  pauseInstallButton: {
    visible: boolean;
    label: string;
  };
};

export type GameReadModelBuildOptions = {
  runtime: GameReadModelRuntime;
  settings: GameReadModelSettings | null;
  overlay: GameReadModelOverlayContext;
};

function cloneReadModelValue<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function getEntityReadModelKind(entity: ReadModelSourceEntity): GameReadModelEntityKind {
  if (entity.player) return "player";
  if (entity.target) return "target";
  if (entity.lifePickup) return "lifePickup";
  if (entity.coinPickup) return "coinPickup";

  throw new Error(`Unsupported read model entity ${entity.id}`);
}

export function createEntityReadModel(entity: ReadModelSourceEntity): GameReadModelEntity {
  return {
    id: entity.id,
    kind: getEntityReadModelKind(entity),
    position: {
      x: entity.transform.x,
      y: entity.transform.y,
    },
    rotation: entity.transform.angle,
    appearance: cloneReadModelValue(entity.appearance),
    ...(entity.movementDirection ? { movementDirection: cloneReadModelValue(entity.movementDirection) } : {}),
    ...(entity.physics ? { collisionRadius: entity.physics.radius } : {}),
  };
}

export function collectEntityReadModels(items: Iterable<ReadModelSourceEntity>): GameReadModelEntity[] {
  return [...items].map((entity) => createEntityReadModel(entity));
}

export function buildSettingsReadModel(settingsEntity: SettingsEntity | null): GameReadModelSettings | null {
  return settingsEntity ? cloneReadModelValue(settingsEntity.settingsState) : null;
}

function createInstallOverlayView(context: GameReadModelOverlayContext): GameReadModelOverlayView | null {
  if (!context.activeInstallOverlay) return null;

  const pwaView = createPwaOverlayViewModel(context.activeInstallOverlay);
  return {
    layout: pwaView.layout,
    variant: pwaView.variant,
    title: pwaView.title,
    message: pwaView.message,
    tips: pwaView.tips,
    buttons: [
      { label: pwaView.primaryLabel, action: "confirmInstall" },
      ...(pwaView.secondaryLabel ? [{ label: pwaView.secondaryLabel, action: "dismissInstall" } as const] : []),
    ],
    installButton: null,
    footerPrompt: null,
    results: null,
  };
}

export function createOverlayView(
  runtime: GameReadModelRuntime,
  context: GameReadModelOverlayContext,
): GameReadModelOverlayView | null {
  if (context.mode === "onboarding") {
    return {
      layout: "modal",
      variant: "default",
      title: "Правила",
      message: "",
      tips: context.rules,
      buttons: [{ label: "Понятно", action: "acceptOnboarding" }],
      installButton: null,
      footerPrompt: null,
      results: null,
    };
  }

  if (context.mode === "pause") {
    return {
      layout: "modal",
      variant: "default",
      title: "Пауза",
      message: context.lastPauseWasAutoPaused ? "Игра остановлена." : "",
      tips: context.rules,
      buttons: [
        { label: "Продолжить", action: "resume" },
        { label: "Настройки", action: "openSettings" },
        { label: "Начать заново", action: "restart" },
      ],
      installButton: context.pauseInstallButton.visible
        ? { label: context.pauseInstallButton.label, surface: "pause" }
        : null,
      footerPrompt: null,
      results: null,
    };
  }

  if (context.mode === "gameOver") {
    const bestScore = runtime.lastRoundBestScore ?? runtime.lastRoundFinalScore;
    return {
      layout: "modal",
      variant: runtime.lastGameOverWasNewBest ? "results-record" : "results",
      title: "Результаты",
      message: "",
      tips: [],
      buttons: [{ label: "Начать заново", action: "restart" }],
      installButton: null,
      footerPrompt: runtime.gameOverInstallPrompt
        ? {
            message: runtime.gameOverInstallPrompt.message,
            button: {
              label: runtime.gameOverInstallPrompt.buttonLabel,
              action: "confirmInstall",
            },
          }
        : null,
      results: {
        baseScore: runtime.lastRoundBaseScore,
        coins: runtime.coins,
        coinBonus: runtime.lastRoundCoinBonus,
        finalScore: runtime.lastRoundFinalScore,
        bestScore,
        wasNewBest: runtime.lastGameOverWasNewBest,
      },
    };
  }

  if (context.mode === "install") {
    return createInstallOverlayView(context);
  }

  return null;
}

export function buildGameReadModel({
  runtime,
  settings,
  overlay,
}: GameReadModelBuildOptions): GameReadModel {
  const entities = collectEntityReadModels(runtime.queries.renderables).sort((left, right) => left.id - right.id);

  return {
    state: runtime.state,
    hud: {
      score: runtime.score,
      coins: runtime.coins,
      lives: runtime.lives,
      maxLives: runtime.maxLives,
      bestScore: runtime.bestScore,
    },
    overlay: {
      mode: overlay.mode,
      view: createOverlayView(runtime, overlay),
    },
    scene: {
      entities,
    },
    roundResult: {
      baseScore: runtime.lastRoundBaseScore,
      coinBonus: runtime.lastRoundCoinBonus,
      finalScore: runtime.lastRoundFinalScore,
      bestScore: runtime.lastRoundBestScore,
      wasNewBest: runtime.lastGameOverWasNewBest,
    },
    gameplayProfile: cloneReadModelValue(runtime.gameplayProfile),
    input: cloneReadModelValue(runtime.input),
    settings,
  };
}
