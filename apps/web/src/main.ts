import { createAdminPage } from "./admin/admin-page.ts";
import { installAnalyticsLifecycleFlush, trackAnalyticsEvent } from "./platform/analytics-client.ts";
import { initializeAppController } from "./app/app-controller.ts";
import { createDomAppUi } from "./app/dom-app-ui.ts";
import { createDomGameUi } from "./game/dom-game-ui.ts";
import { initializeGame } from "./game/game.ts";
import { initializeIcons } from "./icons.ts";
import { syncBestScore } from "./leaderboard/best-score-sync.ts";
import { createLeaderboardPanel } from "./leaderboard/leaderboard-panel.ts";
import { registerPwaServiceWorker } from "./platform/pwa.ts";
import {
  CANVAS_WORLD_SCALE,
  composeCanvasRenderers,
  createCanvasRenderer,
} from "./game/canvas-renderer.ts";
import { isPhoneDevice } from "./platform/device.ts";
import { createPointerFeedback } from "./platform/pointer-feedback.ts";
import { createSettingsPage } from "./settings/settings-page.ts";
import { createGameEventBus } from "./game/game-events.ts";
import { installEventSounds } from "./platform/event-sounds.ts";
import { EVENT_SOUNDS } from "./platform/event-sounds.config.ts";
import { initializeLocale } from "./localization/localization.ts";
import { createFullscreenController } from "./platform/fullscreen.ts";
import { createAuthCard } from "./auth/auth-card.ts";

// Native shells can launch the same web build with `?fullscreen=auto`.
// Regular browser visits keep fullscreen user-controlled.
const AUTO_ENTER_FULLSCREEN = new URLSearchParams(window.location.search).get("fullscreen") === "auto";

function getGameCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById("game");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Canvas element not found");
  }

  return canvas;
}

function getGameCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2D context is not available");
  }

  return context;
}

initializeLocale();

const settingsPage = createSettingsPage();
const fullscreen = createFullscreenController(document, document.documentElement);
fullscreen.initialize({ autoEnter: AUTO_ENTER_FULLSCREEN });
const adminPage = createAdminPage();
const leaderboardPanel = createLeaderboardPanel();
const gameCanvas = getGameCanvas();
const gameContext = getGameCanvasContext(gameCanvas);
const pointerFeedback = createPointerFeedback({
  canvas: gameCanvas,
  context: gameContext,
  isPhoneDevice,
  now: () => performance.now(),
});
const gameRenderer = composeCanvasRenderers(
  createCanvasRenderer({ context: gameContext, scale: CANVAS_WORLD_SCALE }),
  pointerFeedback,
);
const authCard = createAuthCard();
const gameUi = createDomGameUi({
  isFullscreenSupported: () => fullscreen.isSupported(),
  authCard,
});
const appUi = createDomAppUi({
  gameUi,
  settingsPage,
  adminPage,
  body: document.body,
});
const gameEvents = createGameEventBus();
gameEvents.subscribe(({ type, payload }) => trackAnalyticsEvent(type, payload));
installEventSounds(gameEvents, EVENT_SOUNDS);

document.body.append(settingsPage.element, adminPage.element, leaderboardPanel.element);
initializeIcons();
installAnalyticsLifecycleFlush();
void syncBestScore();
window.addEventListener("online", () => {
  void syncBestScore();
});
registerPwaServiceWorker();
pointerFeedback.install();
initializeGame({
  canvas: gameCanvas,
  context: gameContext,
  renderer: gameRenderer,
  ui: gameUi,
  rootStyle: document.documentElement.style,
  events: gameEvents,
  toggleFullscreen: () => fullscreen.toggle(),
  openLeaderboard: () => {
    void leaderboardPanel.open();
  },
});
initializeAppController({
  appUi,
  settingsPage,
});
