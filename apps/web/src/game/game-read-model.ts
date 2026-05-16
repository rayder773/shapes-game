export type GameReadModelState = "boot" | "playing" | "paused" | "gameOver";
export type GameReadModelOverlayMode = "install" | "onboarding" | "pause" | "gameOver" | null;
export type GameReadModelEntityKind = "player" | "target" | "lifePickup" | "coinPickup";
export type GameReadModelOverlayAction =
  | "resume"
  | "restart"
  | "acceptOnboarding"
  | "openSettings"
  | "confirmInstall"
  | "dismissInstall";

export type GameReadModelPosition = {
  x: number;
  y: number;
};

export type GameReadModelAppearance = {
  shape: "circle" | "square" | "triangle";
  color: "red" | "blue" | "green";
  fillStyle: "filled" | "outline" | "dashed";
  size: number;
};

export type GameReadModelMovementDirection = {
  x: number;
  y: number;
};

export type GameReadModelEntity = {
  id: number;
  kind: GameReadModelEntityKind;
  position: GameReadModelPosition;
  rotation: number;
  collisionRadius?: number;
  appearance: GameReadModelAppearance;
  movementDirection?: GameReadModelMovementDirection;
};

export type GameReadModelGameplayProfile = {
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

export type GameReadModelInput = Record<"up" | "down" | "left" | "right", boolean>;

export type GameReadModelHud = {
  score: number;
  coins: number;
  lives: number;
  maxLives: number;
  bestScore: number | null;
};

export type GameReadModelOverlay = {
  mode: GameReadModelOverlayMode;
  view: GameReadModelOverlayView | null;
};

export type GameReadModelOverlayButton = {
  label: string;
  action: GameReadModelOverlayAction;
};

export type GameReadModelOverlayFooterPrompt = {
  message: string;
  button: GameReadModelOverlayButton;
};

export type GameReadModelOverlayInstallButton = {
  label: string;
  surface: "pause" | "postGameOver";
};

export type GameReadModelOverlayResults = {
  baseScore: number;
  coins: number;
  coinBonus: number;
  finalScore: number;
  bestScore: number;
  wasNewBest: boolean;
};

export type GameReadModelOverlayView = {
  layout: "modal" | "sheet";
  variant: "default" | "ios-hint" | "record" | "results" | "results-record";
  title: string;
  message: string;
  tips: string[];
  buttons: GameReadModelOverlayButton[];
  installButton: GameReadModelOverlayInstallButton | null;
  footerPrompt: GameReadModelOverlayFooterPrompt | null;
  results: GameReadModelOverlayResults | null;
};

export type GameReadModelScene = {
  entities: GameReadModelEntity[];
};

export type GameReadModelRoundResult = {
  baseScore: number;
  coinBonus: number;
  finalScore: number;
  bestScore: number | null;
  wasNewBest: boolean;
};

export type GameReadModelSettings = {
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

export type GameReadModel = {
  state: GameReadModelState;
  hud: GameReadModelHud;
  overlay: GameReadModelOverlay;
  scene: GameReadModelScene;
  roundResult: GameReadModelRoundResult;
  gameplayProfile: GameReadModelGameplayProfile;
  input: GameReadModelInput;
  settings: GameReadModelSettings | null;
};
