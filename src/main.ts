import { enterGamePage, enterSettingsPage, initializeGame, persistActiveProfileSettings, resetSettingsDraftToDefaults, setOpenSettingsListener, subscribeToSettingsState, updateSettingsDraft } from "./game.ts";
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

document.body.append(settingsPage.element);

subscribeToSettingsState((state) => {
  settingsPage.render(state);
});

setOpenSettingsListener(() => {
  navigateToRoute("settings");
});

function handleRouteChange(route: AppRoute): void {
  settingsPage.setVisible(route === "settings");

  if (route === "settings") {
    enterSettingsPage();
    return;
  }

  enterGamePage();
}

initializeGame();
initializeRouter();
subscribeToRouteChanges(handleRouteChange);
handleRouteChange(getCurrentRoute());
