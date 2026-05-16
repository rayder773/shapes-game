import type { DomAppUi } from "./dom-app-ui.ts";
import {
  enterGamePage,
  enterNonGamePage,
  enterSettingsPage,
  getAppReadModel,
  setOpenSettingsListener,
} from "./game.ts";
import {
  getCurrentRoute,
  initializeRouter,
  navigateToRoute,
  subscribeToRouteChanges,
  type AppRoute,
} from "./router.ts";
import {
  persistActiveProfileSettings,
  resetSettingsDraftToDefaults,
  subscribeToSettingsState,
  updateSettingsDraft,
} from "./settings-controller.ts";
import type { SettingsPageController } from "./settings-page.ts";

type AppControllerDependencies = {
  appUi: DomAppUi;
  settingsPage: SettingsPageController;
};

function handleRouteEntry(route: AppRoute): void {
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

export function initializeAppController({
  appUi,
  settingsPage,
}: AppControllerDependencies): void {
  function renderAppUi(): void {
    appUi.render(getAppReadModel());
  }

  settingsPage.subscribe((event) => {
    if (event.type === "settings-change") {
      updateSettingsDraft(event.field, event.value);
      renderAppUi();
      return;
    }

    if (event.type === "settings-reset") {
      resetSettingsDraftToDefaults();
      renderAppUi();
      return;
    }

    persistActiveProfileSettings();
    navigateToRoute("game");
  });

  setOpenSettingsListener(() => {
    navigateToRoute("settings");
  });

  subscribeToSettingsState(() => {
    renderAppUi();
  });

  initializeRouter();
  subscribeToRouteChanges((route) => {
    handleRouteEntry(route);
    renderAppUi();
  });
  handleRouteEntry(getCurrentRoute());
  renderAppUi();
}
