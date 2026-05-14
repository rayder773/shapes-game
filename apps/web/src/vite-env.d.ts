/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ANALYTICS_ENDPOINT?: string;
}

type AntiMatchTestEntitySnapshot = {
  id: number;
  kind: "player" | "target" | "lifePickup" | "coinPickup";
  player?: true;
  target?: true;
  lifePickup?: true;
  coinPickup?: true;
  position: {
    x: number;
    y: number;
  };
  rotation: number;
  collisionRadius?: number;
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
  hud: {
    score: number;
    coins: number;
    lives: number;
    maxLives: number;
    bestScore: number | null;
  };
  overlay: {
    mode: "install" | "onboarding" | "pause" | "gameOver" | null;
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
  settings: AntiMatchSettingsState | null;
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
  model: () => AntiMatchTestSnapshot;
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
