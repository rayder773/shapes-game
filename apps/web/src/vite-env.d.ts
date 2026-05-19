/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ANALYTICS_ENDPOINT?: string;
}

type AntiMatchTestEntitySnapshot = {
  id: number;
  kind: "player" | "target" | "lifePickup" | "coinPickup";
  position: {
    x: number;
    y: number;
  };
  rotation: number;
  collisionRadius?: number;
  appearance?: {
    shape: "circle" | "square" | "triangle";
    color: "red" | "blue" | "green";
    fillStyle: "filled" | "outline" | "dashed";
    size: number;
  };
  movementDirection?: {
    x: number;
    y: number;
  };
};

type AntiMatchTestSnapshot = {
  state: "boot" | "playing" | "paused" | "gameOver";
  hud: {
    score: number;
    coins: number;
    lives: number;
    maxLives: number;
    bestScore: number | null;
  };
  overlay: {
    mode: "install" | "onboarding" | "pause" | "gameOver" | null;
    view: AntiMatchOverlayView | null;
  };
  scene: {
    entities: AntiMatchTestEntitySnapshot[];
  };
  roundResult: {
    baseScore: number;
    coinBonus: number;
    finalScore: number;
    bestScore: number | null;
    wasNewBest: boolean;
  };
  gameplayProfile: {
    compactTouch: boolean;
    startTargetCount: number;
    minTargetsAfterScore: number;
    targetSpeed: number;
    playerSpeed: number;
    playerBoostSpeed: number;
    maxTargets: number;
    targetGrowthScoreStep: number;
    lifeSpawnChance: number;
    coinSpawnChance: number;
    startLives: number;
    maxLives: number;
    spawnPadding: number;
    safeSpawnPadding: number;
  };
  input: Record<"up" | "down" | "left" | "right", boolean>;
  settings: AntiMatchSettingsState | null;
};

type AntiMatchOverlayAction =
  | "resume"
  | "restart"
  | "acceptOnboarding"
  | "openSettings"
  | "confirmInstall"
  | "dismissInstall";

type AntiMatchOverlayButton = {
  label: string;
  action: AntiMatchOverlayAction;
};

type AntiMatchOverlayView = {
  layout: "modal" | "sheet";
  variant: "default" | "ios-hint" | "record" | "results" | "results-record";
  title: string;
  message: string;
  tips: string[];
  buttons: AntiMatchOverlayButton[];
  installButton: { label: string; surface: "pause" | "postGameOver" } | null;
  footerPrompt: { message: string; button: AntiMatchOverlayButton } | null;
  results: {
    baseScore: number;
    coins: number;
    coinBonus: number;
    finalScore: number;
    bestScore: number;
    wasNewBest: boolean;
  } | null;
};

type AntiMatchSettingsState = {
  activeProfileKey: "compactTouch" | "desktop";
  saved: {
    compactTouch: Record<string, number | undefined>;
    desktop: Record<string, number | undefined>;
  };
  draft: {
    targetSpeed: number;
    playerSpeed: number;
    playerBoostSpeed: number;
    maxTargets: number;
    targetGrowthScoreStep: number;
    lifeSpawnChancePercent: number;
    startLives: number;
    maxLives: number;
  };
  defaults: {
    targetSpeed: number;
    playerSpeed: number;
    playerBoostSpeed: number;
    maxTargets: number;
    targetGrowthScoreStep: number;
    lifeSpawnChancePercent: number;
    startLives: number;
    maxLives: number;
  };
};

type AntiMatchAppShell = {
  gamePageVisible: boolean;
  settingsPageVisible: boolean;
  adminPageVisible: boolean;
};

type AntiMatchAppSnapshot = {
  route: "game" | "settings" | "admin";
  game: AntiMatchTestSnapshot;
  shell: AntiMatchAppShell;
};

type AntiMatchTestApi = {
  model: () => AntiMatchTestSnapshot;
  appModel: () => AntiMatchAppSnapshot;
  getPlayer: () => AntiMatchTestEntitySnapshot | null;
  getTargets: () => AntiMatchTestEntitySnapshot[];
  getLifePickups: () => AntiMatchTestEntitySnapshot[];
  getCoinPickups: () => AntiMatchTestEntitySnapshot[];
  getSettingsState: () => AntiMatchSettingsState | null;
};

interface Window {
  __ANTI_MATCH_TEST__?: AntiMatchTestApi;
}
