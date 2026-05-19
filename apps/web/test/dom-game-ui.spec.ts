import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import type { AppReadModel } from "../src/app/app-read-model.ts";
import { createDomGameUi, type DomGameUiEvent } from "../src/game/dom-game-ui.ts";
import type { GameReadModel, GameReadModelOverlayView } from "../src/game/game-read-model.ts";

const indexHtml = readFileSync(join(process.cwd(), "index.html"), "utf8");
const bodyMarkupMatch = indexHtml.match(/<body>([\s\S]*)<\/body>/);

if (!bodyMarkupMatch?.[1]) {
  throw new Error("Failed to extract index.html body markup for DOM game UI tests");
}

const bodyMarkup = bodyMarkupMatch[1].trim();

function getElement<T extends Element>(id: string, ctor: { new (...args: never[]): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`Expected #${id} to be ${ctor.name}`);
  }

  return element;
}

function click(element: Element): void {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function createGameplayProfile(): GameReadModel["gameplayProfile"] {
  return {
    compactTouch: false,
    startTargetCount: 3,
    minTargetsAfterScore: 2,
    targetSpeed: 2,
    playerSpeed: 4,
    playerBoostSpeed: 7,
    maxTargets: 8,
    targetGrowthScoreStep: 5,
    lifeSpawnChance: 0.1,
    coinSpawnChance: 0.2,
    startLives: 3,
    maxLives: 5,
    spawnPadding: 1,
    safeSpawnPadding: 2,
  };
}

function createSettings(): NonNullable<GameReadModel["settings"]> {
  return {
    activeProfileKey: "desktop",
    saved: {
      compactTouch: {},
      desktop: {},
    },
    draft: {
      targetSpeed: 2,
      playerSpeed: 4,
      playerBoostSpeed: 7,
      maxTargets: 8,
      targetGrowthScoreStep: 5,
      lifeSpawnChancePercent: 10,
      startLives: 3,
      maxLives: 5,
    },
    defaults: {
      targetSpeed: 2,
      playerSpeed: 4,
      playerBoostSpeed: 7,
      maxTargets: 8,
      targetGrowthScoreStep: 5,
      lifeSpawnChancePercent: 10,
      startLives: 3,
      maxLives: 5,
    },
  };
}

function createAppModel(overrides: {
  state?: GameReadModel["state"];
  hud?: Partial<GameReadModel["hud"]>;
  overlayMode?: GameReadModel["overlay"]["mode"];
  overlayView?: GameReadModelOverlayView | null;
  shell?: Partial<AppReadModel["shell"]>;
} = {}): AppReadModel {
  const hud: GameReadModel["hud"] = {
    score: 12,
    coins: 3,
    lives: 2,
    maxLives: 5,
    bestScore: 21,
    ...overrides.hud,
  };

  return {
    route: "game",
    shell: {
      gamePageVisible: true,
      settingsPageVisible: false,
      adminPageVisible: false,
      ...overrides.shell,
    },
    game: {
      state: overrides.state ?? "playing",
      hud,
      overlay: {
        mode: overrides.overlayMode ?? null,
        view: overrides.overlayView ?? null,
      },
      scene: {
        entities: [],
      },
      roundResult: {
        baseScore: 10,
        coinBonus: hud.coins * 2,
        finalScore: 10 + hud.coins * 2,
        bestScore: hud.bestScore,
        wasNewBest: false,
      },
      gameplayProfile: createGameplayProfile(),
      input: {
        up: false,
        down: false,
        left: false,
        right: false,
      },
      settings: createSettings(),
    },
  };
}

function createOnboardingView(): GameReadModelOverlayView {
  return {
    layout: "modal",
    variant: "default",
    title: "Правила",
    message: "",
    tips: ["Собирай несовпадающие фигуры", "Избегай совпадений"],
    buttons: [{ label: "Понятно", action: "acceptOnboarding" }],
    installButton: null,
    footerPrompt: null,
    results: null,
  };
}

function createPauseView(): GameReadModelOverlayView {
  return {
    layout: "modal",
    variant: "default",
    title: "Пауза",
    message: "Игра остановлена.",
    tips: ["Пауза сохраняет текущий раунд"],
    buttons: [
      { label: "Продолжить", action: "resume" },
      { label: "Настройки", action: "openSettings" },
      { label: "Начать заново", action: "restart" },
    ],
    installButton: { label: "Установить", surface: "pause" },
    footerPrompt: null,
    results: null,
  };
}

function createGameOverView(): GameReadModelOverlayView {
  return {
    layout: "modal",
    variant: "results-record",
    title: "Результаты",
    message: "",
    tips: [],
    buttons: [{ label: "Начать заново", action: "restart" }],
    installButton: null,
    footerPrompt: {
      message: "Можно установить игру на главный экран.",
      button: {
        label: "Установить",
        action: "confirmInstall",
      },
    },
    results: {
      baseScore: 14,
      coins: 4,
      coinBonus: 8,
      finalScore: 22,
      bestScore: 22,
      wasNewBest: true,
    },
  };
}

describe("DOM game UI adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = bodyMarkup;
  });

  test("renders HUD state from the app read model", () => {
    const ui = createDomGameUi();

    ui.render(createAppModel({
      state: "playing",
      hud: {
        score: 42,
        coins: 7,
        lives: 3,
        maxLives: 5,
        bestScore: 99,
      },
    }));

    expect(getElement("hud-score", HTMLParagraphElement).textContent).toBe("Счет: 42");
    expect(getElement("hud-best-value", HTMLSpanElement).textContent).toBe("99");
    expect(getElement("hud-best", HTMLDivElement).getAttribute("aria-label")).toBe("Лучший счет: 99");
    expect(getElement("hud-coins-value", HTMLSpanElement).textContent).toBe("7");
    expect(getElement("hud-coins", HTMLDivElement).getAttribute("aria-label")).toBe("Монеты: 7");
    expect(getElement("hud-lives", HTMLDivElement).getAttribute("aria-label")).toBe("Жизни: 3 из 5");
    expect(document.querySelectorAll("#hud-lives .hud-life")).toHaveLength(5);
    expect(document.querySelectorAll("#hud-lives .hud-life[data-filled='true']")).toHaveLength(3);
    expect(getElement("pause-button", HTMLButtonElement).textContent).toBe("II");
    expect(getElement("pause-button", HTMLButtonElement).getAttribute("aria-label")).toBe("Поставить игру на паузу");

    ui.render(createAppModel({ state: "paused" }));

    expect(getElement("pause-button", HTMLButtonElement).textContent).toBe("▶");
    expect(getElement("pause-button", HTMLButtonElement).getAttribute("aria-label")).toBe("Продолжить игру");
  });

  test("renders onboarding and pause overlays with semantic button actions", () => {
    const ui = createDomGameUi();
    const events: DomGameUiEvent[] = [];
    ui.subscribe((event) => events.push(event));

    ui.render(createAppModel({
      state: "paused",
      overlayMode: "onboarding",
      overlayView: createOnboardingView(),
    }));

    const overlay = getElement("overlay", HTMLDivElement);
    expect(overlay.classList.contains("visible")).toBe(true);
    expect(overlay.getAttribute("aria-hidden")).toBe("false");
    expect(overlay.dataset.layout).toBe("modal");
    expect(overlay.dataset.variant).toBe("default");
    expect(getElement("overlay-title", HTMLHeadingElement).textContent).toBe("Правила");
    expect(getElement("overlay-message", HTMLParagraphElement).hidden).toBe(true);
    expect(document.querySelectorAll("#overlay-tips li")).toHaveLength(2);
    expect(getElement("overlay-primary-button", HTMLButtonElement).textContent).toBe("Понятно");

    click(getElement("overlay-primary-button", HTMLButtonElement));
    expect(events).toContainEqual({ type: "overlay-action", action: "acceptOnboarding" });

    ui.render(createAppModel({
      state: "paused",
      overlayMode: "pause",
      overlayView: createPauseView(),
    }));

    expect(getElement("overlay-title", HTMLHeadingElement).textContent).toBe("Пауза");
    expect(getElement("overlay-message", HTMLParagraphElement).textContent).toBe("Игра остановлена.");
    expect(getElement("overlay-primary-button", HTMLButtonElement).textContent).toBe("Продолжить");
    expect(getElement("overlay-secondary-button", HTMLButtonElement).textContent).toBe("Настройки");
    expect(getElement("overlay-tertiary-button", HTMLButtonElement).textContent).toBe("Начать заново");
    expect(getElement("overlay-install-button", HTMLButtonElement).hidden).toBe(false);

    click(getElement("pause-button", HTMLButtonElement));
    click(getElement("overlay-primary-button", HTMLButtonElement));
    click(getElement("overlay-secondary-button", HTMLButtonElement));
    click(getElement("overlay-tertiary-button", HTMLButtonElement));
    click(getElement("overlay-install-button", HTMLButtonElement));

    expect(events).toEqual([
      { type: "overlay-action", action: "acceptOnboarding" },
      { type: "pause-toggle" },
      { type: "overlay-action", action: "resume" },
      { type: "overlay-action", action: "openSettings" },
      { type: "overlay-action", action: "restart" },
      { type: "open-install-flow", surface: "pause" },
    ]);
  });

  test("renders game over results from model data without game runtime", () => {
    const ui = createDomGameUi();
    const events: DomGameUiEvent[] = [];
    ui.subscribe((event) => events.push(event));

    ui.render(createAppModel({
      state: "gameOver",
      overlayMode: "gameOver",
      overlayView: createGameOverView(),
    }));

    expect(getElement("overlay-title", HTMLHeadingElement).textContent).toBe("Результаты");
    expect(getElement("overlay", HTMLDivElement).dataset.variant).toBe("results-record");
    expect(getElement("overlay-message", HTMLParagraphElement).hidden).toBe(true);
    expect(getElement("results-screen", HTMLElement).hidden).toBe(false);
    expect(getElement("results-base-value", HTMLElement).textContent).toBe("14");
    expect(getElement("results-coins-value", HTMLElement).textContent).toBe("4");
    expect(getElement("results-bonus-value", HTMLElement).textContent).toBe("+0");
    expect(getElement("results-best-value", HTMLElement).textContent).toBe("22");
    expect(getElement("overlay-footer", HTMLDivElement).hidden).toBe(false);
    expect(getElement("overlay-footer-message", HTMLParagraphElement).textContent).toBe("Можно установить игру на главный экран.");
    expect(getElement("overlay-footer-button", HTMLButtonElement).textContent).toBe("Установить");

    click(getElement("overlay-primary-button", HTMLButtonElement));
    click(getElement("overlay-footer-button", HTMLButtonElement));

    expect(events).toEqual([
      { type: "overlay-action", action: "restart" },
      { type: "overlay-action", action: "confirmInstall" },
    ]);
  });

  test("applies app route visibility to game chrome", () => {
    const ui = createDomGameUi();

    ui.render(createAppModel({
      shell: {
        gamePageVisible: false,
        settingsPageVisible: true,
      },
    }));

    expect(getElement("game", HTMLCanvasElement).classList.contains("app-hidden")).toBe(true);
    expect(document.querySelector(".hud")?.classList.contains("app-hidden")).toBe(true);
    expect(getElement("overlay", HTMLDivElement).classList.contains("app-hidden")).toBe(true);

    ui.render(createAppModel({
      shell: {
        gamePageVisible: true,
        settingsPageVisible: false,
      },
    }));

    expect(getElement("game", HTMLCanvasElement).classList.contains("app-hidden")).toBe(false);
    expect(document.querySelector(".hud")?.classList.contains("app-hidden")).toBe(false);
    expect(getElement("overlay", HTMLDivElement).classList.contains("app-hidden")).toBe(false);
  });
});
