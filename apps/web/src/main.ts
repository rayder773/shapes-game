import { createAdminPage } from "./admin/admin-page.ts";
import { installAnalyticsLifecycleFlush } from "./platform/analytics-client.ts";
import { initializeAppController } from "./app/app-controller.ts";
import { createDomAppUi } from "./app/dom-app-ui.ts";
import { createDomGameUi } from "./game/dom-game-ui.ts";
import { initializeGame } from "./game/game.ts";
import { initializeIcons } from "./icons.ts";
import { ensureCurrentPlayerIdentity } from "./leaderboard/leaderboard-api.ts";
import { createLeaderboardPanel } from "./leaderboard/leaderboard-panel.ts";
import { registerPwaServiceWorker } from "./platform/pwa.ts";
import { createSettingsPage } from "./settings/settings-page.ts";

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

const settingsPage = createSettingsPage();
const adminPage = createAdminPage();
const leaderboardPanel = createLeaderboardPanel();
const gameCanvas = getGameCanvas();
const gameContext = getGameCanvasContext(gameCanvas);
const gameUi = createDomGameUi();
const appUi = createDomAppUi({
  gameUi,
  settingsPage,
  adminPage,
  body: document.body,
});

document.body.append(settingsPage.element, adminPage.element, leaderboardPanel.element);
initializeIcons();
installAnalyticsLifecycleFlush();
void ensureCurrentPlayerIdentity();
registerPwaServiceWorker();
initializeGame({
  canvas: gameCanvas,
  context: gameContext,
  ui: gameUi,
  rootStyle: document.documentElement.style,
  openLeaderboard: () => {
    void leaderboardPanel.open();
  },
});
initializeAppController({
  appUi,
  settingsPage,
});
