import type { AppRoute } from "../platform/router.ts";
import type { GameReadModel } from "../game/game-read-model.ts";

export type AppReadModelShell = {
  gamePageVisible: boolean;
  settingsPageVisible: boolean;
  adminPageVisible: boolean;
};

export type AppReadModel = {
  route: AppRoute;
  game: GameReadModel;
  shell: AppReadModelShell;
};
