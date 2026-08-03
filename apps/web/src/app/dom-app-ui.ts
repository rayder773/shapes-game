import type { AppReadModel } from "./app-read-model.ts";
import type { AppRoute } from "../platform/router.ts";
import type { DomGameUi } from "../game/dom-game-ui.ts";
import type { SettingsPageController } from "../settings/settings-page.ts";

type DomAppUiDependencies = {
  gameUi: DomGameUi;
  settingsPage: SettingsPageController;
  adminPage: { setRoute: (route: AppRoute) => void };
  body: HTMLElement;
};

export type DomAppUi = {
  render: (model: AppReadModel) => void;
};

export function createDomAppUi({
  gameUi,
  settingsPage,
  adminPage,
  body,
}: DomAppUiDependencies): DomAppUi {
  return {
    render(model) {
      body.dataset.route = model.route;
      gameUi.render(model);
      settingsPage.render(model);
      adminPage.setRoute(model.route);
    },
  };
}
