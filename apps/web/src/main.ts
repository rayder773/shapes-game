import { createAdminPage } from "./admin/admin-page.ts";
import { installAnalyticsLifecycleFlush } from "./analytics-client.ts";
import { initializeAppController } from "./app-controller.ts";
import { createDomAppUi } from "./dom-app-ui.ts";
import { createDomGameUi } from "./dom-game-ui.ts";
import { initializeGame } from "./game.ts";
import { initializeIcons } from "./icons.ts";
import { registerPwaServiceWorker } from "./pwa.ts";
import { createSettingsPage } from "./settings-page.ts";

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
const gameCanvas = getGameCanvas();
const gameContext = getGameCanvasContext(gameCanvas);
const gameUi = createDomGameUi();
const appUi = createDomAppUi({
  gameUi,
  settingsPage,
  adminPage,
  body: document.body,
});

document.body.append(settingsPage.element, adminPage.element);
initializeIcons();
installAnalyticsLifecycleFlush();
registerPwaServiceWorker();
initializeGame({
  canvas: gameCanvas,
  context: gameContext,
  ui: gameUi,
  rootStyle: document.documentElement.style,
});
initializeAppController({
  appUi,
  settingsPage,
});
