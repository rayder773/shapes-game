import { createAdminPage } from "./admin/admin-page.ts";
import { installAnalyticsLifecycleFlush } from "./analytics-client.ts";
import { enterGamePage, enterNonGamePage, enterSettingsPage, initializeGame, persistActiveProfileSettings, resetSettingsDraftToDefaults, setOpenSettingsListener, subscribeToSettingsState, updateSettingsDraft } from "./game.ts";
import { initializeIcons } from "./icons.ts";
import { registerPwaServiceWorker } from "./pwa.ts";
import { getCurrentRoute, initializeRouter, navigateToRoute, subscribeToRouteChanges, type AppRoute } from "./router.ts";
import { createSettingsPage } from "./settings-page.ts";

const settingsPage = createSettingsPage({
  onValueChange(field, value) {
    updateSettingsDraft(field, value);
  },
  onReset() {
    resetSettingsDraftToDefaults();
  },
  onSave() {
    persistActiveProfileSettings();
    navigateToRoute("game");
  },
});
const adminPage = createAdminPage();

document.body.append(settingsPage.element, adminPage.element);
initializeIcons();
installAnalyticsLifecycleFlush();
registerPwaServiceWorker();

subscribeToSettingsState((state) => {
  settingsPage.render(state);
});

setOpenSettingsListener(() => {
  navigateToRoute("settings");
});

function handleRouteChange(route: AppRoute): void {
  settingsPage.setVisible(route === "settings");
  adminPage.setVisible(route === "admin");
  document.body.dataset.route = route;

  switch (route) {
    case "admin":
      enterNonGamePage();
      return;
    case "settings":
      enterSettingsPage();
      return;
    case "game":
      enterGamePage();
      return;
  }
}

initializeGame();
initializeRouter();
subscribeToRouteChanges(handleRouteChange);
handleRouteChange(getCurrentRoute());
