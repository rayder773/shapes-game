import type { DomAppUi } from "./dom-app-ui.ts";
import {
  enterGamePage,
  enterNonGamePage,
  enterSettingsPage,
  getAppReadModel,
  setOpenSettingsListener,
} from "../game/game.ts";
import {
  getCurrentRoute,
  initializeRouter,
  navigateToRoute,
  subscribeToRouteChanges,
  type AppRoute,
} from "../platform/router.ts";
import type { SettingsPageController } from "../settings/settings-page.ts";
import { setLocale, subscribeToLocaleChange } from "../localization/localization.ts";

type AppControllerDependencies = {
  appUi: DomAppUi;
  settingsPage: SettingsPageController;
};

function handleRouteEntry(route: AppRoute): void {
  switch (route) {
    case "admin":
    case "adminSettings":
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
    if (event.type === "language-change") {
      setLocale(event.locale);
      return;
    }

    navigateToRoute("game");
  });

  setOpenSettingsListener(() => {
    navigateToRoute("settings");
  });

  subscribeToLocaleChange(() => {
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
