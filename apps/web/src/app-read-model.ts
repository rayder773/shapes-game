import type { AppRoute } from "./router.ts";
import type { GameReadModel } from "./game-read-model.ts";

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
