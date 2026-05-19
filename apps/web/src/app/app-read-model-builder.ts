import type { AppReadModel } from "./app-read-model.ts";
import type { GameReadModel } from "../game/game-read-model.ts";
import type { AppRoute } from "../platform/router.ts";

export function buildAppReadModel(route: AppRoute, game: GameReadModel): AppReadModel {
  return {
    route,
    game,
    shell: {
      gamePageVisible: route === "game",
      settingsPageVisible: route === "settings",
      adminPageVisible: route === "admin",
    },
  };
}
