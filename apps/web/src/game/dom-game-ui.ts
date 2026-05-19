import type { AppReadModel } from "../app/app-read-model.ts";
import type { GameReadModelOverlayAction, GameReadModelOverlayView } from "./game-read-model.ts";
import { createLifeIconSvgMarkup } from "../icons.ts";

export type DomGameUiEvent =
  | { type: "pause-toggle" }
  | { type: "overlay-action"; action: GameReadModelOverlayAction }
  | { type: "open-install-flow"; surface: "pause" | "postGameOver" };

type DomGameUiListener = (event: DomGameUiEvent) => void;

const HUD_LIVES_PULSE_MS = 320;
const HUD_COINS_PULSE_MS = 360;

function requireElement<T extends Element>(id: string, ctor: { new (...args: never[]): T }, label: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`${label} not found`);
  }
  return element;
}

function waitForMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function createDomGameUi() {
  const canvas = requireElement("game", HTMLCanvasElement, "Canvas element");
  const hudScore = requireElement("hud-score", HTMLParagraphElement, "HUD score element");
  const hudBest = requireElement("hud-best", HTMLDivElement, "HUD best score element");
  const hudBestValue = requireElement("hud-best-value", HTMLSpanElement, "HUD best score value element");
  const hudCoins = requireElement("hud-coins", HTMLDivElement, "HUD coins element");
  const hudCoinsValue = requireElement("hud-coins-value", HTMLSpanElement, "HUD coins value element");
  const hudLives = requireElement("hud-lives", HTMLDivElement, "HUD lives element");
  const hudElement = hudLives.closest(".hud");
  if (!(hudElement instanceof HTMLDivElement)) {
    throw new Error("HUD container not found");
  }
  const hud = hudElement;
  const pauseButton = requireElement("pause-button", HTMLButtonElement, "Pause button element");
  const overlay = requireElement("overlay", HTMLDivElement, "Overlay element");
  const modalElement = overlay.querySelector(".modal");
  if (!(modalElement instanceof HTMLDivElement)) {
    throw new Error("Modal element not found");
  }
  const modal = modalElement;
  const overlayTitle = requireElement("overlay-title", HTMLHeadingElement, "Overlay title element");
  const overlayMessage = requireElement("overlay-message", HTMLParagraphElement, "Overlay message element");
  const resultsScreen = requireElement("results-screen", HTMLElement, "Results screen element");
  const resultsBaseRow = requireElement("results-base-row", HTMLDivElement, "Results base row element");
  const resultsCoinsRow = requireElement("results-coins-row", HTMLDivElement, "Results coins row element");
  const resultsBonusRow = requireElement("results-bonus-row", HTMLDivElement, "Results bonus row element");
  const resultsBaseValue = requireElement("results-base-value", HTMLElement, "Results base value element");
  const resultsCoinsValue = requireElement("results-coins-value", HTMLElement, "Results coins value element");
  const resultsBonusValue = requireElement("results-bonus-value", HTMLElement, "Results bonus value element");
  const resultsFinalCard = requireElement("results-final-card", HTMLDivElement, "Results final card element");
  const resultsFinalValue = requireElement("results-final-value", HTMLElement, "Results final value element");
  const resultsMeta = requireElement("results-meta", HTMLDivElement, "Results meta element");
  const resultsBestValue = requireElement("results-best-value", HTMLElement, "Results best value element");
  const resultsRecordBadge = requireElement("results-record-badge", HTMLDivElement, "Results record badge element");
  const resultsBurst = requireElement("results-burst", HTMLDivElement, "Results burst element");
  const overlayFooter = requireElement("overlay-footer", HTMLDivElement, "Overlay footer element");
  const overlayFooterMessage = requireElement("overlay-footer-message", HTMLParagraphElement, "Overlay footer message element");
  const overlayFooterButton = requireElement("overlay-footer-button", HTMLButtonElement, "Overlay footer button element");
  const overlayTips = requireElement("overlay-tips", HTMLUListElement, "Overlay tips element");
  const overlayPrimaryButton = requireElement("overlay-primary-button", HTMLButtonElement, "Overlay primary button element");
  const overlaySecondaryButton = requireElement("overlay-secondary-button", HTMLButtonElement, "Overlay secondary button element");
  const overlayTertiaryButton = requireElement("overlay-tertiary-button", HTMLButtonElement, "Overlay tertiary button element");
  const overlayInstallButton = requireElement("overlay-install-button", HTMLButtonElement, "Overlay install button element");
  const listeners = new Set<DomGameUiListener>();
  const overlayButtons = [overlayPrimaryButton, overlaySecondaryButton, overlayTertiaryButton];
  let hudLivesPulseTimeoutId: number | null = null;
  let hudCoinsPulseTimeoutId: number | null = null;
  let resultsAnimationToken = 0;
  let lastCoins = 0;
  let lastLives = 0;
  let lastResultsKey: string | null = null;

  function emit(event: DomGameUiEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function setOverlayTips(items: string[]): void {
    overlayTips.replaceChildren();

    if (items.length === 0) {
      overlayTips.hidden = true;
      return;
    }

    for (const item of items) {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      overlayTips.append(listItem);
    }

    overlayTips.hidden = false;
  }

  function renderLivesHud(lives: number, maxLives: number): void {
    hudLives.replaceChildren();
    hudLives.setAttribute("aria-label", `Жизни: ${lives} из ${maxLives}`);
    const lifeMarkup = createLifeIconSvgMarkup();

    for (let index = 0; index < maxLives; index += 1) {
      const lifeSlot = document.createElement("span");
      lifeSlot.className = "hud-life";
      lifeSlot.innerHTML = lifeMarkup;
      lifeSlot.dataset.filled = index < lives ? "true" : "false";
      hudLives.append(lifeSlot);
    }
  }

  function pulseLivesHud(): void {
    hudLives.dataset.pulse = "true";

    if (hudLivesPulseTimeoutId !== null) {
      window.clearTimeout(hudLivesPulseTimeoutId);
    }

    hudLivesPulseTimeoutId = window.setTimeout(() => {
      delete hudLives.dataset.pulse;
      hudLivesPulseTimeoutId = null;
    }, HUD_LIVES_PULSE_MS);
  }

  function pulseCoinsHud(): void {
    hudCoins.dataset.pulse = "true";

    if (hudCoinsPulseTimeoutId !== null) {
      window.clearTimeout(hudCoinsPulseTimeoutId);
    }

    hudCoinsPulseTimeoutId = window.setTimeout(() => {
      delete hudCoins.dataset.pulse;
      hudCoinsPulseTimeoutId = null;
    }, HUD_COINS_PULSE_MS);
  }

  function resetResultsScreen(): void {
    resultsAnimationToken += 1;
    resultsScreen.hidden = true;
    resultsBurst.replaceChildren();
    resultsBaseRow.classList.remove("is-visible");
    resultsCoinsRow.classList.remove("is-visible");
    resultsBonusRow.classList.remove("is-visible");
    resultsFinalCard.classList.remove("is-visible");
    resultsMeta.classList.remove("is-visible");
    resultsBaseValue.textContent = "0";
    resultsCoinsValue.textContent = "0";
    resultsBonusValue.textContent = "+0";
    resultsFinalValue.textContent = "0";
    resultsBestValue.textContent = "0";
    resultsRecordBadge.hidden = true;
  }

  function launchCoinBurst(): void {
    resultsBurst.replaceChildren();

    for (let index = 0; index < 8; index += 1) {
      const particle = document.createElement("span");
      particle.className = "results-burst-particle";
      const angle = (Math.PI * 2 * index) / 8;
      const distance = 30 + (index % 2) * 16;
      particle.style.setProperty("--burst-x", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--burst-y", `${Math.sin(angle) * distance}px`);
      particle.style.animationDelay = `${index * 20}ms`;
      resultsBurst.append(particle);
    }
  }

  async function animateCount(
    element: HTMLElement,
    token: number,
    to: number,
    options: {
      prefix?: string;
      durationMs?: number;
    } = {},
  ): Promise<void> {
    const prefix = options.prefix ?? "";
    const durationMs = options.durationMs ?? 420;
    const fromText = element.textContent?.replace(/[^\d-]/g, "") ?? "0";
    const from = Number(fromText) || 0;

    if (from === to) {
      element.textContent = `${prefix}${to}`;
      return;
    }

    const startTime = performance.now();

    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        if (token !== resultsAnimationToken) {
          resolve();
          return;
        }

        const progress = Math.min(1, (now - startTime) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(from + (to - from) * eased);
        element.textContent = `${prefix}${value}`;

        if (progress < 1) {
          window.requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };

      window.requestAnimationFrame(tick);
    });
  }

  async function playResultsScreenAnimation(view: GameReadModelOverlayView): Promise<void> {
    if (!view.results) return;

    const token = ++resultsAnimationToken;
    const results = view.results;

    resultsScreen.hidden = false;
    resultsBaseValue.textContent = String(results.baseScore);
    resultsCoinsValue.textContent = String(results.coins);
    resultsBonusValue.textContent = "+0";
    resultsFinalValue.textContent = "0";
    resultsBestValue.textContent = String(results.bestScore);
    resultsRecordBadge.hidden = true;

    resultsBaseRow.classList.add("is-visible");
    await waitForMs(180);
    if (token !== resultsAnimationToken) return;

    resultsCoinsRow.classList.add("is-visible");
    await waitForMs(180);
    if (token !== resultsAnimationToken) return;

    resultsBonusRow.classList.add("is-visible");
    launchCoinBurst();
    await animateCount(resultsBonusValue, token, results.coinBonus, {
      prefix: "+",
      durationMs: Math.max(280, Math.min(560, 220 + results.coins * 40)),
    });
    if (token !== resultsAnimationToken) return;

    resultsFinalCard.classList.add("is-visible");
    await animateCount(resultsFinalValue, token, results.finalScore, {
      durationMs: Math.max(420, Math.min(760, 360 + results.finalScore * 12)),
    });
    if (token !== resultsAnimationToken) return;

    resultsMeta.classList.add("is-visible");
    resultsBestValue.textContent = String(results.bestScore);
    resultsRecordBadge.hidden = !results.wasNewBest;
  }

  function clearOverlay(): void {
    delete overlay.dataset.layout;
    delete overlay.dataset.variant;
    setOverlayTips([]);
    overlayMessage.hidden = false;
    for (const button of [...overlayButtons, overlayInstallButton, overlayFooterButton]) {
      button.disabled = false;
      delete button.dataset.action;
      delete button.dataset.surface;
    }
    overlayTertiaryButton.hidden = true;
    overlayInstallButton.hidden = true;
    overlayFooter.hidden = true;
    resetResultsScreen();
    overlay.classList.remove("visible");
    overlay.setAttribute("aria-hidden", "true");
    lastResultsKey = null;
  }

  function renderOverlay(view: GameReadModelOverlayView | null): void {
    if (!view) {
      clearOverlay();
      return;
    }

    overlay.dataset.layout = view.layout;
    overlay.dataset.variant = view.variant;
    overlayTitle.textContent = view.title;
    overlayMessage.textContent = view.message;
    overlayMessage.hidden = view.message.length === 0;
    setOverlayTips(view.tips);

    view.buttons.forEach((button, index) => {
      const element = overlayButtons[index];
      if (!element) return;

      element.textContent = button.label;
      element.dataset.action = button.action;
      element.hidden = false;
      element.disabled = false;
    });

    for (let index = view.buttons.length; index < overlayButtons.length; index += 1) {
      const element = overlayButtons[index]!;
      element.textContent = "";
      delete element.dataset.action;
      element.hidden = true;
      element.disabled = false;
    }

    if (view.footerPrompt) {
      overlayFooterMessage.textContent = view.footerPrompt.message;
      overlayFooterButton.textContent = view.footerPrompt.button.label;
      overlayFooterButton.dataset.action = view.footerPrompt.button.action;
      overlayFooterButton.disabled = false;
      overlayFooter.hidden = false;
    } else {
      overlayFooterMessage.textContent = "";
      overlayFooterButton.textContent = "";
      delete overlayFooterButton.dataset.action;
      overlayFooterButton.disabled = false;
      overlayFooter.hidden = true;
    }

    if (view.results) {
      const nextResultsKey = JSON.stringify(view.results);
      if (nextResultsKey !== lastResultsKey) {
        resetResultsScreen();
        lastResultsKey = nextResultsKey;
        void playResultsScreenAnimation(view);
      }
    } else {
      resetResultsScreen();
      lastResultsKey = null;
    }

    overlayInstallButton.textContent = view.installButton?.label ?? "";
    overlayInstallButton.dataset.surface = view.installButton?.surface ?? "";
    overlayInstallButton.disabled = false;
    overlayInstallButton.hidden = view.installButton === null;
    overlay.classList.add("visible");
    overlay.setAttribute("aria-hidden", "false");
  }

  pauseButton.addEventListener("click", () => {
    emit({ type: "pause-toggle" });
  });

  for (const button of [...overlayButtons, overlayFooterButton]) {
    button.addEventListener("click", () => {
      const action = button.dataset.action as GameReadModelOverlayAction | undefined;
      if (!action) return;
      emit({ type: "overlay-action", action });
    });
  }

  overlayInstallButton.addEventListener("click", () => {
    const surface = overlayInstallButton.dataset.surface === "postGameOver" ? "postGameOver" : "pause";
    emit({ type: "open-install-flow", surface });
  });

  return {
    modal,
    render(model: AppReadModel): void {
      const { hud: hudModel } = model.game;
      hudScore.textContent = `Счет: ${hudModel.score}`;
      const bestScore = hudModel.bestScore ?? 0;
      hudBestValue.textContent = String(bestScore);
      hudBest.setAttribute("aria-label", `Лучший счет: ${bestScore}`);
      hudCoinsValue.textContent = String(hudModel.coins);
      hudCoins.setAttribute("aria-label", `Монеты: ${hudModel.coins}`);
      renderLivesHud(hudModel.lives, hudModel.maxLives);
      pauseButton.textContent = model.game.state === "paused" ? "▶" : "II";
      pauseButton.setAttribute("aria-label", model.game.state === "paused" ? "Продолжить игру" : "Поставить игру на паузу");

      if (hudModel.coins > lastCoins) {
        pulseCoinsHud();
      }
      if (hudModel.lives > lastLives) {
        pulseLivesHud();
      }

      canvas.classList.toggle("app-hidden", !model.shell.gamePageVisible);
      hud.classList.toggle("app-hidden", !model.shell.gamePageVisible);
      overlay.classList.toggle("app-hidden", !model.shell.gamePageVisible);
      renderOverlay(model.game.overlay.view);

      lastCoins = hudModel.coins;
      lastLives = hudModel.lives;
    },
    subscribe(listener: DomGameUiListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type DomGameUi = ReturnType<typeof createDomGameUi>;
