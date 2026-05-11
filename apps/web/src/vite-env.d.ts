/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ANALYTICS_ENDPOINT?: string;
}

type AntiMatchTestEntitySnapshot = {
  id: number;
  player?: true;
  target?: true;
  lifePickup?: true;
  coinPickup?: true;
  transform?: {
    x: number;
    y: number;
    angle: number;
  };
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
  physics?: {
    bodyId: number;
    radius: number;
  };
};

type AntiMatchTestSnapshot = {
  state: "boot" | "playing" | "paused" | "gameOver";
  score: number;
  coins: number;
  lives: number;
  maxLives: number;
  bestScore: number | null;
  lastRoundBaseScore: number;
  lastRoundCoinBonus: number;
  lastRoundFinalScore: number;
  lastRoundBestScore: number | null;
  lastGameOverWasNewBest: boolean;
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
  entities: AntiMatchTestEntitySnapshot[];
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

type AntiMatchTestApi = {
  snapshot: () => AntiMatchTestSnapshot;
  getPlayer: () => AntiMatchTestEntitySnapshot | null;
  getTargets: () => AntiMatchTestEntitySnapshot[];
  getLifePickups: () => AntiMatchTestEntitySnapshot[];
  getCoinPickups: () => AntiMatchTestEntitySnapshot[];
  getSettingsState: () => AntiMatchSettingsState | null;
};

interface Window {
  __ANTI_MATCH_TEST__?: AntiMatchTestApi;
}
