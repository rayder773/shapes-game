import { World as ECSWorld, type Query, type With } from "miniplex";
import {
  Box,
  Circle,
  Polygon,
  Vec2,
  World as PhysicsWorld,
  type Body,
  type BodyDef,
  type Contact,
  type FixtureDef,
  type Shape as PhysicsShape,
  type Vec2Value,
} from "planck";
import {
  applyGameplayOverrides,
  clampGameplaySettingValue,
  createEmptySavedGameplaySettings,
  createPersistableOverrides,
  DEFAULT_TARGET_GROWTH_SCORE_STEP,
  loadSavedGameplaySettings,
  saveGameplaySettings,
  type GameplayProfileKey,
  type GameplaySettingsValues,
  type SavedGameplaySettings,
} from "./gameplay-settings.ts";
import { isPhoneDevice } from "./device.ts";
import {
  createPwaOverlayViewModel,
  createPwaController,
  subscribeToPwaStateChanges,
  type PwaActionResult,
  type PwaInlineInstallPrompt,
  type PwaInstallOverlayModel,
} from "./pwa.ts";
import {
  createLifeIconSvgMarkup,
  getCoinHexagonPoints,
  getCoinInnerRadius,
  getCoinSpokes,
  getLifeCrossSegments,
  getLifeDiamondPoints,
} from "./icons.ts";

type Shape = "circle" | "square" | "triangle";
type ColorName = "red" | "blue" | "green";
type FillStyleName = "filled" | "outline" | "dashed";
type InputKey = "up" | "down" | "left" | "right";
type PhysicsBodyKind = "entity" | "wall";
type GameState = "boot" | "playing" | "paused" | "gameOver";
type OverlayMode = "install" | "onboarding" | "pause" | "gameOver" | null;

type EntityId = number;
type PhysicsBodyId = number;

type Transform = {
  x: number;
  y: number;
  angle: number;
};

type Appearance = {
  shape: Shape;
  color: ColorName;
  fillStyle: FillStyleName;
  size: number;
};

type PhysicsComponent = {
  bodyId: PhysicsBodyId;
  radius: number;
};

type MovementDirection = {
  x: number;
  y: number;
};

type GameplaySettingsState = {
  activeProfileKey: GameplayProfileKey;
  saved: SavedGameplaySettings;
  draft: GameplaySettingsValues;
  defaults: GameplaySettingsValues;
};

type GameEntity = {
  id: EntityId;
  transform?: Transform;
  appearance?: Appearance;
  physics?: PhysicsComponent;
  movementDirection?: MovementDirection;
  renderable?: true;
  player?: true;
  target?: true;
  lifePickup?: true;
  coinPickup?: true;
  settingsState?: GameplaySettingsState;
};

type InputSnapshot = Record<InputKey, boolean>;

type CanvasMetrics = {
  dpr: number;
  widthCss: number;
  heightCss: number;
  widthPx: number;
  heightPx: number;
};

type GameplayProfile = {
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

type PhysicsCommand = {
  type: "set-velocity";
  bodyId: PhysicsBodyId;
  velocity: Vec2Value;
};

type GameplayCommand =
  | {
      type: "consume-target";
      playerId: EntityId;
      targetId: EntityId;
    }
  | {
      type: "lose-life";
      playerId: EntityId;
      targetId: EntityId;
    }
  | {
      type: "collect-life";
      playerId: EntityId;
      lifeId: EntityId;
    }
  | {
      type: "collect-coin";
      playerId: EntityId;
      coinId: EntityId;
    }
  | {
      type: "game-over";
    };

type SpawnRequest =
  | {
      type: "spawn-target";
      safeForPlayer: boolean;
      safeAppearance?: Appearance;
    }
  | {
      type: "spawn-life";
    }
  | {
      type: "spawn-coin";
    };

type CollisionEvent =
  | {
      type: "player-target";
      playerId: EntityId;
      targetId: EntityId;
    }
  | {
      type: "player-life";
      playerId: EntityId;
      lifeId: EntityId;
    }
  | {
      type: "player-coin";
      playerId: EntityId;
      coinId: EntityId;
    };

type QueueState = {
  physics: PhysicsCommand[];
  gameplay: GameplayCommand[];
  spawns: SpawnRequest[];
  collisionEvents: CollisionEvent[];
};

type PlayerEntity = With<GameEntity, "player" | "transform" | "appearance" | "physics" | "movementDirection">;
type TargetEntity = With<GameEntity, "target" | "transform" | "appearance" | "physics" | "movementDirection">;
type LifePickupEntity = With<GameEntity, "lifePickup" | "transform" | "appearance" | "physics" | "movementDirection">;
type CoinPickupEntity = With<GameEntity, "coinPickup" | "transform" | "appearance" | "physics" | "movementDirection">;
type PhysicsEntity = With<GameEntity, "transform" | "physics" | "movementDirection">;
type RenderableEntity = With<GameEntity, "transform" | "appearance" | "renderable">;
type AppearancePhysicsEntity = With<GameEntity, "appearance" | "physics" | "movementDirection">;
type InteractiveEntity = With<GameEntity, "transform" | "appearance" | "physics" | "movementDirection">;
type SettingsEntity = With<GameEntity, "settingsState">;

type QuerySet = {
  players: Query<PlayerEntity>;
  targets: Query<TargetEntity>;
  lifePickups: Query<LifePickupEntity>;
  coinPickups: Query<CoinPickupEntity>;
  physicsBodies: Query<PhysicsEntity>;
  renderables: Query<RenderableEntity>;
  settings: Query<SettingsEntity>;
};

type PlanckBodyUserData = {
  bodyId: PhysicsBodyId;
  kind: PhysicsBodyKind;
  entityId?: EntityId;
};

type PhysicsBodySnapshot = {
  bodyId: PhysicsBodyId;
  radius: number;
  x: number;
  y: number;
};

type Bounds = {
  width: number;
  height: number;
};

type DynamicBodySpec = {
  entityId: EntityId;
  position: Vec2Value;
  angle: number;
  linearDamping: number;
  angularDamping: number;
  bullet: boolean;
  shape: Shape;
  size: number;
  velocity: Vec2Value;
  angularVelocity: number;
};

type ContactPassThroughPredicate = (bodyIdA: PhysicsBodyId, bodyIdB: PhysicsBodyId) => boolean;

type PhysicsAdapter = {
  createWorld(bounds: Bounds): void;
  destroyWorld(): void;
  createDynamicBody(spec: DynamicBodySpec): PhysicsBodyId;
  destroyBody(bodyId: PhysicsBodyId): void;
  setShape(bodyId: PhysicsBodyId, shapeSpec: { shape: Shape; size: number }): void;
  setVelocity(bodyId: PhysicsBodyId, velocity: Vec2Value): void;
  getVelocity(bodyId: PhysicsBodyId): Vec2Value | null;
  setSpeedAlongDirection(bodyId: PhysicsBodyId, direction: Vec2Value, speed: number): void;
  setContactPassThroughPredicate(predicate: ContactPassThroughPredicate | null): void;
  step(dt: number): void;
  readTransform(bodyId: PhysicsBodyId): Transform | null;
  resizeBounds(bounds: Bounds, dynamicBodies: PhysicsBodySnapshot[]): void;
  drainCollisionEvents(): Array<{ bodyIdA: PhysicsBodyId; bodyIdB: PhysicsBodyId }>;
};

type Runtime = {
  state: GameState;
  score: number;
  coins: number;
  bestScore: number | null;
  lastGameOverWasNewBest: boolean;
  previousBestScoreBeforeGameOver: number | null;
  lastRoundBaseScore: number;
  lastRoundCoinBonus: number;
  lastRoundFinalScore: number;
  lastRoundBestScore: number | null;
  gameOverInstallPrompt: PwaInlineInstallPrompt | null;
  nextEntityId: number;
  accumulator: number;
  lastFrameTime: number;
  ecsWorld: ECSWorld<GameEntity>;
  queries: QuerySet;
  physicsAdapter: PhysicsAdapter | null;
  input: InputSnapshot;
  canvasMetrics: CanvasMetrics;
  gameplayProfile: GameplayProfile;
  queues: QueueState;
  playerBoostExpiresAt: number;
  lives: number;
  maxLives: number;
  damageInvulnerabilityExpiresAt: number;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export type SettingsViewState = {
  activeProfileKey: GameplayProfileKey;
  draft: GameplaySettingsValues;
};

type SettingsStateListener = (state: SettingsViewState) => void;
type OpenSettingsListener = () => void;

const SCALE = 30;
const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 1 / 24;
const MIN_POINTER_TARGET_DISTANCE = 10;
const PLAYER_BOOST_DURATION_MS = 350;
const DAMAGE_INVULNERABILITY_MS = 900;
const HUD_LIVES_PULSE_MS = 320;
const HUD_COINS_PULSE_MS = 360;
const DOUBLE_TAP_WINDOW_MS = 300;
const DOUBLE_TAP_RADIUS_PX = 40;
const LINEAR_DAMPING = 0;
const ANGULAR_DAMPING = 0.6;
const ENTITY_SIZE = 0.55;
const LIFE_ENTITY_SIZE = 0.42;
const COIN_ENTITY_SIZE = 0.4;
const COIN_BONUS_MULTIPLIER = 2;
const WALL_THICKNESS = 0.35;
const MAX_SPAWN_ATTEMPTS = 80;
const MIN_DIRECTION_LENGTH = 0.0001;
const SHAPES: Shape[] = ["circle", "square", "triangle"];
const COLORS: ColorName[] = ["red", "blue", "green"];
const FILL_STYLES: FillStyleName[] = ["filled", "outline", "dashed"];
const COLOR_MAP: Record<ColorName, string> = {
  red: "#ff5f5f",
  blue: "#66a8ff",
  green: "#59e093",
};
const LIFE_COLOR = "#b894ff";
const COIN_COLOR = "#ffd166";
const DIRECTIONAL_KEYS = new Set<string>(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);
const PAUSE_KEY = "escape";
const RULES_STORAGE_KEY = "shapes-game.rulesAccepted";
const BEST_SCORE_STORAGE_KEY = "shapes-game.bestScore";
const SETTINGS_ENTITY_ID = 0;
const GAME_RULES = [
  "Клик, тап или клавиши мгновенно меняют направление, скорость всегда остается постоянной.",
  "Съедать можно только фигуры, которые отличаются по всем трем свойствам.",
  "Если совпадает хотя бы одно свойство, теряется жизнь. Забег заканчивается, когда жизни кончаются.",
];
const canvasElement = document.getElementById("game");
if (!(canvasElement instanceof HTMLCanvasElement)) {
  throw new Error("Canvas element not found");
}
const canvas = canvasElement;
const context2d = canvas.getContext("2d");
if (!context2d) {
  throw new Error("2D context is not available");
}
const ctx = context2d;

const hudScoreElement = document.getElementById("hud-score");
if (!(hudScoreElement instanceof HTMLParagraphElement)) {
  throw new Error("HUD score element not found");
}
const hudScore = hudScoreElement;

const hudCoinsElement = document.getElementById("hud-coins");
if (!(hudCoinsElement instanceof HTMLDivElement)) {
  throw new Error("HUD coins element not found");
}
const hudCoins = hudCoinsElement;

const hudCoinsValueElement = document.getElementById("hud-coins-value");
if (!(hudCoinsValueElement instanceof HTMLSpanElement)) {
  throw new Error("HUD coins value element not found");
}
const hudCoinsValue = hudCoinsValueElement;

const hudLivesElement = document.getElementById("hud-lives");
if (!(hudLivesElement instanceof HTMLDivElement)) {
  throw new Error("HUD lives element not found");
}
const hudLives = hudLivesElement;
const hudElement = hudLives.closest(".hud");
if (!(hudElement instanceof HTMLDivElement)) {
  throw new Error("HUD container not found");
}
const hud = hudElement;

const pauseButtonElement = document.getElementById("pause-button");
if (!(pauseButtonElement instanceof HTMLButtonElement)) {
  throw new Error("Pause button element not found");
}
const pauseButton = pauseButtonElement;

const overlayElement = document.getElementById("overlay");
if (!(overlayElement instanceof HTMLDivElement)) {
  throw new Error("Overlay element not found");
}
const overlay = overlayElement;

const modalElement = overlay.querySelector(".modal");
if (!(modalElement instanceof HTMLDivElement)) {
  throw new Error("Modal element not found");
}
const modal = modalElement;

const overlayTitleElement = document.getElementById("overlay-title");
if (!(overlayTitleElement instanceof HTMLHeadingElement)) {
  throw new Error("Overlay title element not found");
}
const overlayTitle = overlayTitleElement;

const overlayMessageElement = document.getElementById("overlay-message");
if (!(overlayMessageElement instanceof HTMLParagraphElement)) {
  throw new Error("Overlay message element not found");
}
const overlayMessage = overlayMessageElement;

const resultsScreenElement = document.getElementById("results-screen");
if (!(resultsScreenElement instanceof HTMLElement)) {
  throw new Error("Results screen element not found");
}
const resultsScreen = resultsScreenElement;

const resultsBaseRowElement = document.getElementById("results-base-row");
if (!(resultsBaseRowElement instanceof HTMLDivElement)) {
  throw new Error("Results base row element not found");
}
const resultsBaseRow = resultsBaseRowElement;

const resultsCoinsRowElement = document.getElementById("results-coins-row");
if (!(resultsCoinsRowElement instanceof HTMLDivElement)) {
  throw new Error("Results coins row element not found");
}
const resultsCoinsRow = resultsCoinsRowElement;

const resultsBonusRowElement = document.getElementById("results-bonus-row");
if (!(resultsBonusRowElement instanceof HTMLDivElement)) {
  throw new Error("Results bonus row element not found");
}
const resultsBonusRow = resultsBonusRowElement;

const resultsBaseValueElement = document.getElementById("results-base-value");
if (!(resultsBaseValueElement instanceof HTMLElement)) {
  throw new Error("Results base value element not found");
}
const resultsBaseValue = resultsBaseValueElement;

const resultsCoinsValueElement = document.getElementById("results-coins-value");
if (!(resultsCoinsValueElement instanceof HTMLElement)) {
  throw new Error("Results coins value element not found");
}
const resultsCoinsValue = resultsCoinsValueElement;

const resultsBonusValueElement = document.getElementById("results-bonus-value");
if (!(resultsBonusValueElement instanceof HTMLElement)) {
  throw new Error("Results bonus value element not found");
}
const resultsBonusValue = resultsBonusValueElement;

const resultsFinalCardElement = document.getElementById("results-final-card");
if (!(resultsFinalCardElement instanceof HTMLDivElement)) {
  throw new Error("Results final card element not found");
}
const resultsFinalCard = resultsFinalCardElement;

const resultsFinalValueElement = document.getElementById("results-final-value");
if (!(resultsFinalValueElement instanceof HTMLElement)) {
  throw new Error("Results final value element not found");
}
const resultsFinalValue = resultsFinalValueElement;

const resultsMetaElement = document.getElementById("results-meta");
if (!(resultsMetaElement instanceof HTMLDivElement)) {
  throw new Error("Results meta element not found");
}
const resultsMeta = resultsMetaElement;

const resultsBestValueElement = document.getElementById("results-best-value");
if (!(resultsBestValueElement instanceof HTMLElement)) {
  throw new Error("Results best value element not found");
}
const resultsBestValue = resultsBestValueElement;

const resultsRecordBadgeElement = document.getElementById("results-record-badge");
if (!(resultsRecordBadgeElement instanceof HTMLDivElement)) {
  throw new Error("Results record badge element not found");
}
const resultsRecordBadge = resultsRecordBadgeElement;

const resultsBurstElement = document.getElementById("results-burst");
if (!(resultsBurstElement instanceof HTMLDivElement)) {
  throw new Error("Results burst element not found");
}
const resultsBurst = resultsBurstElement;

const overlayFooterElement = document.getElementById("overlay-footer");
if (!(overlayFooterElement instanceof HTMLDivElement)) {
  throw new Error("Overlay footer element not found");
}
const overlayFooter = overlayFooterElement;

const overlayFooterMessageElement = document.getElementById("overlay-footer-message");
if (!(overlayFooterMessageElement instanceof HTMLParagraphElement)) {
  throw new Error("Overlay footer message element not found");
}
const overlayFooterMessage = overlayFooterMessageElement;

const overlayFooterButtonElement = document.getElementById("overlay-footer-button");
if (!(overlayFooterButtonElement instanceof HTMLButtonElement)) {
  throw new Error("Overlay footer button element not found");
}
const overlayFooterButton = overlayFooterButtonElement;

const overlayTipsElement = document.getElementById("overlay-tips");
if (!(overlayTipsElement instanceof HTMLUListElement)) {
  throw new Error("Overlay tips element not found");
}
const overlayTips = overlayTipsElement;

const overlayPrimaryButtonElement = document.getElementById("overlay-primary-button");
if (!(overlayPrimaryButtonElement instanceof HTMLButtonElement)) {
  throw new Error("Overlay primary button element not found");
}
const overlayPrimaryButton = overlayPrimaryButtonElement;

const overlaySecondaryButtonElement = document.getElementById("overlay-secondary-button");
if (!(overlaySecondaryButtonElement instanceof HTMLButtonElement)) {
  throw new Error("Overlay secondary button element not found");
}
const overlaySecondaryButton = overlaySecondaryButtonElement;

const overlayInstallButtonElement = document.getElementById("overlay-install-button");
if (!(overlayInstallButtonElement instanceof HTMLButtonElement)) {
  throw new Error("Overlay install button element not found");
}
const overlayInstallButton = overlayInstallButtonElement;
const rootStyle = document.documentElement.style;
const settingsStateListeners = new Set<SettingsStateListener>();
const pwa = createPwaController();
let openSettingsListener: OpenSettingsListener | null = null;
const game = createRuntime();
let overlayMode: OverlayMode = null;
let shouldRetryFullscreen = true;
let hasStartedFrameLoop = false;
let hasInitializedGameSession = false;
let shouldRestartGameOnNextGameRoute = false;
let isGameRouteActive = false;
let hudLivesPulseTimeoutId: number | null = null;
let hudCoinsPulseTimeoutId: number | null = null;
let resultsAnimationToken = 0;

function createRuntime(): Runtime {
  const ecsWorld = new ECSWorld<GameEntity>();
  const canvasMetrics = createCanvasMetrics();

  return {
    state: "boot",
    score: 0,
    coins: 0,
    bestScore: null,
    lastGameOverWasNewBest: false,
    previousBestScoreBeforeGameOver: null,
    lastRoundBaseScore: 0,
    lastRoundCoinBonus: 0,
    lastRoundFinalScore: 0,
    lastRoundBestScore: null,
    gameOverInstallPrompt: null,
    nextEntityId: 1,
    accumulator: 0,
    lastFrameTime: 0,
    ecsWorld,
    queries: createQueries(ecsWorld),
    physicsAdapter: null,
    input: createInputSnapshot(),
    canvasMetrics,
    gameplayProfile: createGameplayProfile(canvasMetrics),
    queues: createQueues(),
    playerBoostExpiresAt: 0,
    lives: 3,
    maxLives: 5,
    damageInvulnerabilityExpiresAt: 0,
  };
}

function createQueries(ecsWorld: ECSWorld<GameEntity>): QuerySet {
  return {
    players: ecsWorld.with("player", "transform", "appearance", "physics", "movementDirection"),
    targets: ecsWorld.with("target", "transform", "appearance", "physics", "movementDirection"),
    lifePickups: ecsWorld.with("lifePickup", "transform", "appearance", "physics", "movementDirection"),
    coinPickups: ecsWorld.with("coinPickup", "transform", "appearance", "physics", "movementDirection"),
    physicsBodies: ecsWorld.with("transform", "physics", "movementDirection"),
    renderables: ecsWorld.with("transform", "appearance", "renderable"),
    settings: ecsWorld.with("settingsState"),
  };
}

function createInputSnapshot(): InputSnapshot {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
  };
}

function createGameplayProfile(_metrics: CanvasMetrics): GameplayProfile {
  const compactTouch = isPhoneDevice();

  if (compactTouch) {
    return {
      compactTouch,
      startTargetCount: 5,
      minTargetsAfterScore: 6,
      targetSpeed: 2,
      playerSpeed: 5,
      playerBoostSpeed: 10,
      maxTargets: 12,
      targetGrowthScoreStep: DEFAULT_TARGET_GROWTH_SCORE_STEP,
      lifeSpawnChance: 0.15,
      coinSpawnChance: 0.15,
      startLives: 3,
      maxLives: 5,
      spawnPadding: 2.25,
      safeSpawnPadding: 3.1,
    };
  }

  return {
    compactTouch,
    startTargetCount: 9,
    minTargetsAfterScore: 10,
    targetSpeed: 2,
    playerSpeed: 5,
    playerBoostSpeed: 10,
    maxTargets: 20,
    targetGrowthScoreStep: DEFAULT_TARGET_GROWTH_SCORE_STEP,
    lifeSpawnChance: 0.15,
    coinSpawnChance: 0.15,
    startLives: 3,
    maxLives: 5,
    spawnPadding: 1.8,
    safeSpawnPadding: 2.3,
  };
}

function getGameplayProfileKey(profile: GameplayProfile): GameplayProfileKey {
  return profile.compactTouch ? "compactTouch" : "desktop";
}

function getGameplaySettingsValues(profile: GameplayProfile): GameplaySettingsValues {
  return {
    targetSpeed: profile.targetSpeed,
    playerSpeed: profile.playerSpeed,
    playerBoostSpeed: profile.playerBoostSpeed,
    maxTargets: profile.maxTargets,
    targetGrowthScoreStep: profile.targetGrowthScoreStep,
    lifeSpawnChancePercent: Math.round(profile.lifeSpawnChance * 100),
    startLives: profile.startLives,
    maxLives: profile.maxLives,
  };
}

function getSettingsEntity(): SettingsEntity | null {
  for (const entity of game.queries.settings) {
    return entity;
  }

  return null;
}

function getSavedOverridesForProfile(profileKey: GameplayProfileKey) {
  const settingsEntity = getSettingsEntity();
  return settingsEntity?.settingsState.saved[profileKey] ?? {};
}

function syncSettingsStateWithProfile(resetDraft = false): void {
  const settingsEntity = getSettingsEntity();
  if (!settingsEntity) return;

  const defaultProfile = createGameplayProfile(game.canvasMetrics);
  const activeProfileKey = getGameplayProfileKey(defaultProfile);
  const defaults = getGameplaySettingsValues(defaultProfile);
  const shouldReplaceDraft = resetDraft || settingsEntity.settingsState.activeProfileKey !== activeProfileKey;

  settingsEntity.settingsState.activeProfileKey = activeProfileKey;
  settingsEntity.settingsState.defaults = defaults;

  if (shouldReplaceDraft) {
    settingsEntity.settingsState.draft = applyGameplayOverrides(defaults, settingsEntity.settingsState.saved[activeProfileKey]);
  }

  notifySettingsStateListeners();
}

function resolveGameplayProfile(metrics: CanvasMetrics): GameplayProfile {
  const baseProfile = createGameplayProfile(metrics);
  const profileKey = getGameplayProfileKey(baseProfile);
  const values = applyGameplayOverrides(getGameplaySettingsValues(baseProfile), getSavedOverridesForProfile(profileKey));

  return {
    ...baseProfile,
    targetSpeed: values.targetSpeed,
    playerSpeed: values.playerSpeed,
    playerBoostSpeed: values.playerBoostSpeed,
    maxTargets: values.maxTargets,
    targetGrowthScoreStep: values.targetGrowthScoreStep,
    lifeSpawnChance: values.lifeSpawnChancePercent / 100,
    startLives: Math.min(values.startLives, values.maxLives),
    maxLives: values.maxLives,
  };
}

function getGameplayProfile(): GameplayProfile {
  return game.gameplayProfile;
}

function updateGameplayProfile(resetDraft = false): void {
  syncSettingsStateWithProfile(resetDraft);
  game.gameplayProfile = resolveGameplayProfile(game.canvasMetrics);
}

function initializeSettingsState(savedSettings: SavedGameplaySettings): void {
  const defaultProfile = createGameplayProfile(game.canvasMetrics);
  const activeProfileKey = getGameplayProfileKey(defaultProfile);
  const defaults = getGameplaySettingsValues(defaultProfile);
  const draft = applyGameplayOverrides(defaults, savedSettings[activeProfileKey]);

  game.ecsWorld.add({
    id: SETTINGS_ENTITY_ID,
    settingsState: {
      activeProfileKey,
      saved: {
        compactTouch: savedSettings.compactTouch ?? createEmptySavedGameplaySettings().compactTouch,
        desktop: savedSettings.desktop ?? createEmptySavedGameplaySettings().desktop,
      },
      draft,
      defaults,
    },
  });
  notifySettingsStateListeners();
}

function renderLivesHud(): void {
  hudLives.replaceChildren();
  hudLives.setAttribute("aria-label", `Жизни: ${game.lives} из ${game.maxLives}`);
  const lifeMarkup = createLifeIconSvgMarkup();

  for (let index = 0; index < game.maxLives; index += 1) {
    const lifeSlot = document.createElement("span");
    lifeSlot.className = "hud-life";
    lifeSlot.innerHTML = lifeMarkup;
    lifeSlot.dataset.filled = index < game.lives ? "true" : "false";
    hudLives.append(lifeSlot);
  }
}

function pulseLivesHud(): void {
  hudLives.dataset.pulse = "true";

  if (hudLivesPulseTimeoutId !== null) {
    window.clearTimeout(hudLivesPulseTimeoutId);
  }

  hudLivesPulseTimeoutId = window.setTimeout(() => {
    delete hudLives.dataset.pulse;
    hudLivesPulseTimeoutId = null;
  }, HUD_LIVES_PULSE_MS);
}

function pulseCoinsHud(): void {
  hudCoins.dataset.pulse = "true";

  if (hudCoinsPulseTimeoutId !== null) {
    window.clearTimeout(hudCoinsPulseTimeoutId);
  }

  hudCoinsPulseTimeoutId = window.setTimeout(() => {
    delete hudCoins.dataset.pulse;
    hudCoinsPulseTimeoutId = null;
  }, HUD_COINS_PULSE_MS);
}

function updateHud(): void {
  hudScore.textContent = `Счет: ${game.score}`;
  hudCoinsValue.textContent = String(game.coins);
  hudCoins.setAttribute("aria-label", `Монеты: ${game.coins}`);
  renderLivesHud();
  pauseButton.textContent = game.state === "paused" ? "▶" : "II";
  pauseButton.setAttribute("aria-label", game.state === "paused" ? "Продолжить игру" : "Поставить игру на паузу");
}

function getSettingsViewState(): SettingsViewState | null {
  const settingsEntity = getSettingsEntity();
  if (!settingsEntity) return null;

  return {
    activeProfileKey: settingsEntity.settingsState.activeProfileKey,
    draft: settingsEntity.settingsState.draft,
  };
}

function notifySettingsStateListeners(): void {
  const state = getSettingsViewState();
  if (!state) return;

  for (const listener of settingsStateListeners) {
    listener(state);
  }
}

export function subscribeToSettingsState(listener: SettingsStateListener): () => void {
  settingsStateListeners.add(listener);
  const state = getSettingsViewState();
  if (state) {
    listener(state);
  }

  return () => {
    settingsStateListeners.delete(listener);
  };
}

export function setOpenSettingsListener(listener: OpenSettingsListener): void {
  openSettingsListener = listener;
}

export function updateSettingsDraft(field: keyof GameplaySettingsValues, value: number): void {
  const settingsEntity = getSettingsEntity();
  if (!settingsEntity) return;

  settingsEntity.settingsState.draft[field] = clampGameplaySettingValue(value, field);

  if (field === "startLives" && settingsEntity.settingsState.draft.startLives > settingsEntity.settingsState.draft.maxLives) {
    settingsEntity.settingsState.draft.maxLives = settingsEntity.settingsState.draft.startLives;
  }

  if (field === "maxLives" && settingsEntity.settingsState.draft.startLives > settingsEntity.settingsState.draft.maxLives) {
    settingsEntity.settingsState.draft.startLives = settingsEntity.settingsState.draft.maxLives;
  }

  notifySettingsStateListeners();
}

export function resetSettingsDraftToDefaults(): void {
  const settingsEntity = getSettingsEntity();
  if (!settingsEntity) return;

  settingsEntity.settingsState.draft = {
    ...settingsEntity.settingsState.defaults,
  };
  notifySettingsStateListeners();
}

export function persistActiveProfileSettings(): void {
  const settingsEntity = getSettingsEntity();
  if (!settingsEntity) return;

  const { activeProfileKey, defaults, draft, saved } = settingsEntity.settingsState;
  saved[activeProfileKey] = createPersistableOverrides(draft, defaults);
  saveGameplaySettings(saved);
  updateGameplayProfile(true);
  shouldRestartGameOnNextGameRoute = true;
}

function setDirectionalInput(inputKey: InputKey, isPressed: boolean): void {
  game.input[inputKey] = isPressed;
}

function clearActiveTouchInputs(): void {
}

function createCanvasMetrics(): CanvasMetrics {
  return {
    dpr: 1,
    widthCss: 0,
    heightCss: 0,
    widthPx: 0,
    heightPx: 0,
  };
}

function createQueues(): QueueState {
  return {
    physics: [],
    gameplay: [],
    spawns: [],
    collisionEvents: [],
  };
}

function getViewportSize(): { width: number; height: number } {
  const viewport = window.visualViewport;

  if (viewport) {
    return {
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function syncViewportCssVars(widthCss: number, heightCss: number): void {
  rootStyle.setProperty("--app-width", `${widthCss}px`);
  rootStyle.setProperty("--app-height", `${heightCss}px`);
}

function normalizeVector(vector: Vec2Value): MovementDirection | null {
  const length = Math.hypot(vector.x, vector.y);
  if (length < MIN_DIRECTION_LENGTH) return null;

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function getRandomDirection(): MovementDirection {
  const angle = randomRange(0, Math.PI * 2);
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

function executePhysicsCommand(command: PhysicsCommand): void {
  if (command.type === "set-velocity") {
    game.physicsAdapter?.setVelocity(command.bodyId, command.velocity);
  }
}

function isPlayerBoostActive(): boolean {
  return game.playerBoostExpiresAt > performance.now();
}

function isDamageInvulnerabilityActive(): boolean {
  return game.damageInvulnerabilityExpiresAt > performance.now();
}

function getEntitySpeed(entity: PhysicsEntity): number {
  if (entity.player) {
    const profile = getGameplayProfile();
    return isPlayerBoostActive() ? profile.playerBoostSpeed : profile.playerSpeed;
  }
  return getGameplayProfile().targetSpeed;
}

function setEntityMovementDirection(entity: PhysicsEntity, direction: Vec2Value): void {
  const normalizedDirection = normalizeVector(direction);
  if (!normalizedDirection) return;

  entity.movementDirection = normalizedDirection;
}

// Direct velocity assignment provides instant steering by overwriting accumulated momentum.
function setEntityVelocityAlongDirection(entity: PhysicsEntity, direction: Vec2Value): void {
  const normalizedDirection = normalizeVector(direction);
  if (!normalizedDirection) return;

  entity.movementDirection = normalizedDirection;
  const speed = getEntitySpeed(entity);
  executePhysicsCommand({
    type: "set-velocity",
    bodyId: entity.physics.bodyId,
    velocity: {
      x: normalizedDirection.x * speed,
      y: normalizedDirection.y * speed,
    },
  });
}

function getKeyboardDirection(): MovementDirection | null {
  const x = (game.input.right ? 1 : 0) - (game.input.left ? 1 : 0);
  const y = (game.input.up ? 1 : 0) - (game.input.down ? 1 : 0);
  return normalizeVector({ x, y });
}

function refreshPlayerDirectionFromKeyboard(): void {
  if (game.state !== "playing") return;

  const player = getPlayerEntity();
  if (!player) return;

  const direction = getKeyboardDirection();
  if (!direction) return;

  setEntityVelocityAlongDirection(player, direction);
}

function setPointerDirection(pointerX: number, pointerY: number): void {
  if (game.state !== "playing") return;

  const player = getPlayerEntity();
  if (!player) return;

  const playerCanvasPosition = worldToCanvas(player.transform.x, player.transform.y);
  const deltaX = pointerX - playerCanvasPosition.x;
  const deltaY = pointerY - playerCanvasPosition.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < MIN_POINTER_TARGET_DISTANCE) return;

  setEntityVelocityAlongDirection(player, {
    x: deltaX / distance,
    y: -deltaY / distance,
  });
}

function getFullscreenRoot(): FullscreenElement {
  return document.documentElement as FullscreenElement;
}

function getFullscreenDocument(): FullscreenDocument {
  return document as FullscreenDocument;
}

function isFullscreenActive(): boolean {
  const fullscreenDocument = getFullscreenDocument();
  return Boolean(document.fullscreenElement || fullscreenDocument.webkitFullscreenElement);
}

async function requestGameFullscreen(): Promise<boolean> {
  if (isFullscreenActive()) {
    shouldRetryFullscreen = false;
    return true;
  }

  const fullscreenRoot = getFullscreenRoot();
  const requestFullscreen = fullscreenRoot.requestFullscreen?.bind(fullscreenRoot)
    ?? fullscreenRoot.webkitRequestFullscreen?.bind(fullscreenRoot);

  if (!requestFullscreen) {
    shouldRetryFullscreen = false;
    return false;
  }

  try {
    await requestFullscreen();
    shouldRetryFullscreen = false;
    return true;
  } catch {
    shouldRetryFullscreen = true;
    return false;
  }
}

function scheduleInitialFullscreenAttempt(): void {
  void requestGameFullscreen();
}

function retryFullscreenOnUserGesture(): void {
  if (!shouldRetryFullscreen || isFullscreenActive()) return;
  void requestGameFullscreen();
}

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  return Boolean(target.closest("button, a, input, select, textarea, summary, [role=\"button\"]"));
}

function installBrowserInteractionGuards(): void {
  const touchOptions: AddEventListenerOptions = { passive: false };
  const preventGesture = (event: Event): void => {
    event.preventDefault();
  };

  document.addEventListener("touchstart", (event) => {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  }, touchOptions);

  document.addEventListener("touchmove", (event) => {
    if (event.touches.length > 1 || !isInteractiveElement(event.target)) {
      event.preventDefault();
    }
  }, touchOptions);

  document.addEventListener("gesturestart", preventGesture, touchOptions);
  document.addEventListener("gesturechange", preventGesture, touchOptions);
  document.addEventListener("gestureend", preventGesture, touchOptions);
  document.addEventListener("wheel", (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
    }
  }, touchOptions);
}

function installDoubleTapZoomGuard(element: HTMLElement): void {
  const touchOptions: AddEventListenerOptions = { passive: false };
  let lastTouchEndTime = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;

  element.addEventListener("touchend", (event) => {
    if (event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const elapsed = event.timeStamp - lastTouchEndTime;
    const isRapidSecondTap = elapsed > 0 && elapsed < 350;
    const isNearbyTap =
      Math.abs(touch.clientX - lastTouchX) < 24 &&
      Math.abs(touch.clientY - lastTouchY) < 24;

    lastTouchEndTime = event.timeStamp;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;

    if (isRapidSecondTap && isNearbyTap) {
      event.preventDefault();
    }
  }, touchOptions);
}

  function randomItem<T>(items: readonly T[]): T {
    return items[Math.floor(Math.random() * items.length)] as T;
  }

  function randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function getCanvasMetrics(): CanvasMetrics {
    return game.canvasMetrics;
  }

  function getWorldBounds(): Bounds {
    const metrics = getCanvasMetrics();
    return {
      width: metrics.widthCss / SCALE,
      height: metrics.heightCss / SCALE,
    };
  }

  function worldToCanvas(x: number, y: number): Vec2Value {
    const metrics = getCanvasMetrics();
    return {
      x: x * SCALE,
      y: metrics.heightCss - y * SCALE,
    };
  }

  function areAllPropertiesDifferent(sourceAppearance: Appearance, targetAppearance: Appearance): boolean {
    return (
      sourceAppearance.shape !== targetAppearance.shape &&
      sourceAppearance.color !== targetAppearance.color &&
      sourceAppearance.fillStyle !== targetAppearance.fillStyle
    );
  }

  function chooseDifferent<T>(options: readonly T[], currentValue: T): T {
    return randomItem(options.filter((value) => value !== currentValue));
  }

  function getTriangleVertices(size: number): Vec2Value[] {
    return [
      { x: 0, y: size },
      { x: -size * 0.92, y: -size * 0.58 },
      { x: size * 0.92, y: -size * 0.58 },
    ];
  }

  function getShapeRadius(shape: Shape, size: number): number {
    if (shape === "circle") return size;
    if (shape === "square") return Math.hypot(size, size);
    return size * 1.05;
  }

  function createEntityProperties(safeForAppearance: Appearance | null = null): Omit<Appearance, "size"> {
    if (!safeForAppearance) {
      return {
        shape: randomItem(SHAPES),
        color: randomItem(COLORS),
        fillStyle: randomItem(FILL_STYLES),
      };
    }

    return {
      shape: chooseDifferent(SHAPES, safeForAppearance.shape),
      color: chooseDifferent(COLORS, safeForAppearance.color),
      fillStyle: chooseDifferent(FILL_STYLES, safeForAppearance.fillStyle),
    };
  }

  function createLifePickupAppearance(): Appearance {
    return {
      shape: "square",
      color: "green",
      fillStyle: "outline",
      size: LIFE_ENTITY_SIZE,
    };
  }

  function createCoinPickupAppearance(): Appearance {
    return {
      shape: "circle",
      color: "red",
      fillStyle: "outline",
      size: COIN_ENTITY_SIZE,
    };
  }

  function getDesiredTargetCount(score: number): number {
    const profile = getGameplayProfile();
    const startTargetCount = Math.min(profile.startTargetCount, profile.maxTargets);
    const minTargetsAfterScore = Math.min(profile.minTargetsAfterScore, profile.maxTargets);

    if (score === 0) {
      return startTargetCount;
    }

    if (profile.targetGrowthScoreStep <= 0) {
      return minTargetsAfterScore;
    }

    return Math.min(
      minTargetsAfterScore + Math.floor(score / profile.targetGrowthScoreStep),
      profile.maxTargets,
    );
  }

function clearInputState(): void {
  setDirectionalInput("up", false);
  setDirectionalInput("down", false);
  setDirectionalInput("left", false);
  setDirectionalInput("right", false);
}

function setOverlayTips(items: string[]): void {
  overlayTips.replaceChildren();

  if (items.length === 0) {
    overlayTips.hidden = true;
    return;
  }

  for (const item of items) {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    overlayTips.append(listItem);
  }

  overlayTips.hidden = false;
}

function areRulesAccepted(): boolean {
  return window.localStorage.getItem(RULES_STORAGE_KEY) === "true";
}

function setRulesAccepted(): void {
  window.localStorage.setItem(RULES_STORAGE_KEY, "true");
}

function loadBestScore(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
  if (rawValue === null) {
    return null;
  }

  const bestScore = Number(rawValue);
  if (!Number.isFinite(bestScore) || bestScore < 0) {
    return null;
  }

  return Math.floor(bestScore);
}

function saveBestScore(score: number): void {
  window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(Math.max(0, Math.floor(score))));
}

function waitForMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function animateCount(
  element: HTMLElement,
  token: number,
  to: number,
  options: {
    prefix?: string;
    durationMs?: number;
  } = {},
): Promise<void> {
  const prefix = options.prefix ?? "";
  const durationMs = options.durationMs ?? 420;
  const fromText = element.textContent?.replace(/[^\d-]/g, "") ?? "0";
  const from = Number(fromText) || 0;

  if (from === to) {
    element.textContent = `${prefix}${to}`;
    return;
  }

  const startTime = performance.now();

  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      if (token !== resultsAnimationToken) {
        resolve();
        return;
      }

      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (to - from) * eased);
      element.textContent = `${prefix}${value}`;

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };

    window.requestAnimationFrame(tick);
  });
}

function resetResultsScreen(): void {
  resultsAnimationToken += 1;
  resultsScreen.hidden = true;
  resultsBurst.replaceChildren();
  resultsBaseRow.classList.remove("is-visible");
  resultsCoinsRow.classList.remove("is-visible");
  resultsBonusRow.classList.remove("is-visible");
  resultsFinalCard.classList.remove("is-visible");
  resultsMeta.classList.remove("is-visible");
  resultsBaseValue.textContent = "0";
  resultsCoinsValue.textContent = "0";
  resultsBonusValue.textContent = "+0";
  resultsFinalValue.textContent = "0";
  resultsBestValue.textContent = "0";
  resultsRecordBadge.hidden = true;
}

function launchCoinBurst(): void {
  resultsBurst.replaceChildren();

  for (let index = 0; index < 8; index += 1) {
    const particle = document.createElement("span");
    particle.className = "results-burst-particle";
    const angle = (Math.PI * 2 * index) / 8;
    const distance = 30 + (index % 2) * 16;
    particle.style.setProperty("--burst-x", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--burst-y", `${Math.sin(angle) * distance}px`);
    particle.style.animationDelay = `${index * 20}ms`;
    resultsBurst.append(particle);
  }
}

async function playResultsScreenAnimation(): Promise<void> {
  const token = ++resultsAnimationToken;
  const coinBonus = game.lastRoundCoinBonus;
  const bestScore = game.lastRoundBestScore ?? game.lastRoundFinalScore;

  resultsScreen.hidden = false;
  resultsBaseValue.textContent = String(game.lastRoundBaseScore);
  resultsCoinsValue.textContent = String(game.coins);
  resultsBonusValue.textContent = "+0";
  resultsFinalValue.textContent = "0";
  resultsBestValue.textContent = String(bestScore);
  resultsRecordBadge.hidden = true;

  resultsBaseRow.classList.add("is-visible");
  await waitForMs(180);
  if (token !== resultsAnimationToken) return;

  resultsCoinsRow.classList.add("is-visible");
  await waitForMs(180);
  if (token !== resultsAnimationToken) return;

  resultsBonusRow.classList.add("is-visible");
  launchCoinBurst();
  await animateCount(resultsBonusValue, token, coinBonus, {
    prefix: "+",
    durationMs: Math.max(280, Math.min(560, 220 + game.coins * 40)),
  });
  if (token !== resultsAnimationToken) return;

  resultsFinalCard.classList.add("is-visible");
  await animateCount(resultsFinalValue, token, game.lastRoundFinalScore, {
    durationMs: Math.max(420, Math.min(760, 360 + game.lastRoundFinalScore * 12)),
  });
  if (token !== resultsAnimationToken) return;

  resultsMeta.classList.add("is-visible");
  resultsBestValue.textContent = String(bestScore);
  resultsRecordBadge.hidden = !game.lastGameOverWasNewBest;
}

function continueEntryOverlayFlow(): void {
  if (!areRulesAccepted()) {
    startOnboarding();
    return;
  }

  if (game.state === "paused") {
    resumeGame();
  }
}

function showOnboardingOverlay(): void {
  overlayMode = "onboarding";
  renderOverlay({
    layout: "modal",
    variant: "default",
    title: "Правила",
    message: "",
    tips: GAME_RULES,
    primaryLabel: "Понятно",
    secondaryLabel: null,
    installButton: null,
    footerPrompt: null,
  });
}

function renderOverlay(model: {
  layout: "modal" | "sheet";
  variant: "default" | "ios-hint" | "record" | "results" | "results-record";
  title: string;
  message: string;
  tips: string[];
  primaryLabel: string;
  secondaryLabel: string | null;
  installButton: { label: string } | null;
  footerPrompt: PwaInlineInstallPrompt | null;
}): void {
  overlay.dataset.layout = model.layout;
  overlay.dataset.variant = model.variant;
  overlayTitle.textContent = model.title;
  overlayMessage.textContent = model.message;
  overlayMessage.hidden = model.message.length === 0;
  resetResultsScreen();
  setOverlayTips(model.tips);
  overlayPrimaryButton.textContent = model.primaryLabel;
  overlaySecondaryButton.textContent = model.secondaryLabel ?? "";
  overlaySecondaryButton.hidden = model.secondaryLabel === null;
  overlayInstallButton.textContent = model.installButton?.label ?? "";
  overlayInstallButton.hidden = model.installButton === null;
  overlayFooterMessage.textContent = model.footerPrompt?.message ?? "";
  overlayFooterButton.textContent = model.footerPrompt?.buttonLabel ?? "";
  overlayFooter.hidden = model.footerPrompt === null;
  overlayPrimaryButton.disabled = false;
  overlaySecondaryButton.disabled = false;
  overlayInstallButton.disabled = false;
  overlayFooterButton.disabled = false;
  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
}

function showPauseOverlay(autoPaused: boolean): void {
  overlayMode = "pause";
  const installButtonState = pwa.getPauseInstallButtonState();
  renderOverlay({
    layout: "modal",
    variant: "default",
    title: "Пауза",
    message: autoPaused ? "Игра остановлена." : "",
    tips: GAME_RULES,
    primaryLabel: "Продолжить",
    secondaryLabel: "Настройки",
    installButton: installButtonState.visible ? { label: installButtonState.label } : null,
    footerPrompt: null,
  });
}

function showGameOverOverlay(): void {
  overlayMode = "gameOver";
  renderOverlay({
    layout: "modal",
    variant: game.lastGameOverWasNewBest ? "results-record" : "results",
    title: "Результаты",
    message: "",
    tips: [],
    primaryLabel: "Начать заново",
    secondaryLabel: null,
    installButton: null,
    footerPrompt: game.gameOverInstallPrompt,
  });
  void playResultsScreenAnimation();
}

function hideOverlay(): void {
  overlayMode = null;
  delete overlay.dataset.layout;
  delete overlay.dataset.variant;
  setOverlayTips([]);
  overlayMessage.hidden = false;
  overlayPrimaryButton.disabled = false;
  overlaySecondaryButton.disabled = false;
  overlayInstallButton.disabled = false;
  overlayFooterButton.disabled = false;
  overlayInstallButton.hidden = true;
  overlayFooter.hidden = true;
  resetResultsScreen();
  overlay.classList.remove("visible");
  overlay.setAttribute("aria-hidden", "true");
}

function pauseGame(autoPaused = false): void {
  if (game.state !== "playing") return;

  game.state = "paused";
  game.accumulator = 0;
  game.lastFrameTime = performance.now();
  game.playerBoostExpiresAt = 0;
  clearInputState();
  clearActiveTouchInputs();
  showPauseOverlay(autoPaused);
  updateHud();
}

function resumeGame(): void {
  if (game.state !== "paused") return;

  hideOverlay();
  clearInputState();
  clearActiveTouchInputs();
  game.accumulator = 0;
  game.lastFrameTime = performance.now();
  game.state = "playing";
  updateHud();
}

function startOnboarding(): void {
  game.state = "paused";
  game.accumulator = 0;
  game.lastFrameTime = performance.now();
  clearInputState();
  clearActiveTouchInputs();
  showOnboardingOverlay();
  updateHud();
}

function showExternalOverlay(model: PwaInstallOverlayModel): void {
  overlayMode = "install";

  if (model.surface === "postGameOver") {
    game.accumulator = 0;
    clearInputState();
    clearActiveTouchInputs();
    renderOverlay({
      ...createPwaOverlayViewModel(model),
      installButton: null,
      footerPrompt: null,
    });
    updateHud();
    return;
  }

  game.state = "paused";
  game.accumulator = 0;
  game.lastFrameTime = performance.now();
  clearInputState();
  clearActiveTouchInputs();
  renderOverlay({
    ...createPwaOverlayViewModel(model),
    installButton: null,
    footerPrompt: null,
  });
  updateHud();
}

function applyOverlayFlowResult(result: PwaActionResult): void {
  if (result.type === "none") {
    return;
  }

  if (result.type === "show-install-overlay") {
    showExternalOverlay(result.overlay);
    return;
  }

  if (result.target === "pause" && game.state === "paused") {
    showPauseOverlay(false);
    updateHud();
    return;
  }

  if (result.target === "gameOver") {
    showGameOverOverlay();
    updateHud();
    return;
  }

  hideOverlay();
  updateHud();
}

function togglePauseGame(): void {
  if (game.state === "playing") {
    pauseGame(false);
    return;
  }

  if (game.state === "paused") {
    resumeGame();
  }
}

  function createPhysicsAdapter(): PhysicsAdapter {
    let world: PhysicsWorld | null = null;
    let nextBodyId = 1;
    let wallBodyIds: PhysicsBodyId[] = [];
    let queuedContacts: Array<{ bodyIdA: PhysicsBodyId; bodyIdB: PhysicsBodyId }> = [];
    let passThroughPredicate: ContactPassThroughPredicate | null = null;
    const bodies = new Map<PhysicsBodyId, Body>();

    function createShapeGeometry(shape: Shape, size: number): PhysicsShape {
      if (shape === "circle") return Circle(size);
      if (shape === "square") return Box(size, size);
      return Polygon(getTriangleVertices(size).map((vertex) => Vec2(vertex.x, vertex.y)));
    }

    function createFixtureOptions(shape: Shape, size: number): FixtureDef {
      return {
        shape: createShapeGeometry(shape, size),
        density: 1,
        friction: 0,
        restitution: 1,
      };
    }

    function clearFixtures(body: Body): void {
      for (let fixture = body.getFixtureList(); fixture; ) {
        const next = fixture.getNext();
        body.destroyFixture(fixture);
        fixture = next;
      }
    }

    function createWalls(bounds: Bounds): void {
      if (!world) return;

      const halfThickness = WALL_THICKNESS * 0.5;
      const wallDefs = [
        { x: bounds.width * 0.5, y: -halfThickness, hx: bounds.width * 0.5, hy: halfThickness },
        { x: bounds.width * 0.5, y: bounds.height + halfThickness, hx: bounds.width * 0.5, hy: halfThickness },
        { x: -halfThickness, y: bounds.height * 0.5, hx: halfThickness, hy: bounds.height * 0.5 },
        { x: bounds.width + halfThickness, y: bounds.height * 0.5, hx: halfThickness, hy: bounds.height * 0.5 },
      ];

      const currentWorld = world;

      wallBodyIds = wallDefs.map((wallDef) => {
        const bodyId = nextBodyId++;
        const bodyDefinition: BodyDef = {
          type: "static",
          position: Vec2(wallDef.x, wallDef.y),
          userData: { bodyId, kind: "wall" satisfies PhysicsBodyKind },
        };
        const body = currentWorld.createBody(bodyDefinition);

        body.createFixture({
          shape: Box(wallDef.hx, wallDef.hy),
          friction: 0,
          restitution: 1,
        });

        bodies.set(bodyId, body);
        return bodyId;
      });
    }

    function destroyWalls(): void {
      if (!world) return;

      for (const bodyId of wallBodyIds) {
        const body = bodies.get(bodyId);
        if (!body) continue;
        world.destroyBody(body);
        bodies.delete(bodyId);
      }

      wallBodyIds = [];
    }

    return {
      createWorld(bounds) {
        world = new PhysicsWorld(Vec2(0, 0));
        const nextWorld = world;
        nextBodyId = 1;
        wallBodyIds = [];
        queuedContacts = [];
        bodies.clear();

        nextWorld.on("begin-contact", (contact: Contact) => {
          const bodyIdA = (contact.getFixtureA().getBody().getUserData() as PlanckBodyUserData | undefined)?.bodyId ?? null;
          const bodyIdB = (contact.getFixtureB().getBody().getUserData() as PlanckBodyUserData | undefined)?.bodyId ?? null;

          if (bodyIdA === null || bodyIdB === null) return;

          queuedContacts.push({ bodyIdA, bodyIdB });
        });

        nextWorld.on("pre-solve", (contact: Contact) => {
          if (!passThroughPredicate) return;
          const bodyIdA = (contact.getFixtureA().getBody().getUserData() as PlanckBodyUserData | undefined)?.bodyId ?? null;
          const bodyIdB = (contact.getFixtureB().getBody().getUserData() as PlanckBodyUserData | undefined)?.bodyId ?? null;
          if (bodyIdA === null || bodyIdB === null) return;
          if (passThroughPredicate(bodyIdA, bodyIdB)) {
            contact.setEnabled(false);
          }
        });

        createWalls(bounds);
      },

      destroyWorld() {
        if (!world) return;

        for (const body of bodies.values()) {
          world.destroyBody(body);
        }

        bodies.clear();
        wallBodyIds = [];
        queuedContacts = [];
        world = null;
      },

      createDynamicBody(spec) {
        if (!world) {
          throw new Error("Physics world is not initialized");
        }

        const bodyId = nextBodyId++;
        const bodyDefinition: BodyDef = {
          type: "dynamic",
          position: Vec2(spec.position.x, spec.position.y),
          angle: spec.angle,
          linearDamping: spec.linearDamping,
          angularDamping: spec.angularDamping,
          bullet: spec.bullet,
          userData: { bodyId, kind: "entity" satisfies PhysicsBodyKind, entityId: spec.entityId },
        };
        const body = world.createBody(bodyDefinition);

        body.createFixture(createFixtureOptions(spec.shape, spec.size));
        body.setLinearVelocity(Vec2(spec.velocity.x, spec.velocity.y));
        body.setAngularVelocity(spec.angularVelocity);
        bodies.set(bodyId, body);
        return bodyId;
      },

      destroyBody(bodyId) {
        if (!world) return;
        const body = bodies.get(bodyId);
        if (!body) return;
        world.destroyBody(body);
        bodies.delete(bodyId);
      },

      setShape(bodyId, shapeSpec) {
        const body = bodies.get(bodyId);
        if (!body) return;
        clearFixtures(body);
        body.createFixture(createFixtureOptions(shapeSpec.shape, shapeSpec.size));
        body.resetMassData();
      },

      setVelocity(bodyId, velocity) {
        const body = bodies.get(bodyId);
        if (!body) return;
        body.setLinearVelocity(Vec2(velocity.x, velocity.y));
      },

      getVelocity(bodyId) {
        const body = bodies.get(bodyId);
        if (!body) return null;

        const velocity = body.getLinearVelocity();
        return { x: velocity.x, y: velocity.y };
      },

      setSpeedAlongDirection(bodyId, direction, speed) {
        const body = bodies.get(bodyId);
        const normalizedDirection = normalizeVector(direction);
        if (!body || !normalizedDirection) return;

        body.setLinearVelocity(Vec2(normalizedDirection.x * speed, normalizedDirection.y * speed));
      },

      setContactPassThroughPredicate(predicate) {
        passThroughPredicate = predicate;
      },

      step(dt) {
        world?.step(dt);
      },

      readTransform(bodyId) {
        const body = bodies.get(bodyId);
        if (!body) return null;

        const position = body.getPosition();
        return {
          x: position.x,
          y: position.y,
          angle: body.getAngle(),
        };
      },

      resizeBounds(bounds, dynamicBodies) {
        if (!world) return;

        destroyWalls();
        createWalls(bounds);

        for (const dynamicBody of dynamicBodies) {
          const body = bodies.get(dynamicBody.bodyId);
          if (!body) continue;

          const nextX = clamp(dynamicBody.x, dynamicBody.radius, bounds.width - dynamicBody.radius);
          const nextY = clamp(dynamicBody.y, dynamicBody.radius, bounds.height - dynamicBody.radius);
          body.setPosition(Vec2(nextX, nextY));
          body.setAwake(true);
        }
      },

      drainCollisionEvents() {
        const events = queuedContacts;
        queuedContacts = [];
        return events;
      },
    };
  }

  function getPlayerEntity(): PlayerEntity | null {
    for (const entity of game.queries.players) {
      return entity;
    }

    return null;
  }

  function getTargetCount(): number {
    let count = 0;

    for (const entity of game.queries.targets) {
      void entity;
      count += 1;
    }

    return count;
  }

  function hasLifePickup(): boolean {
    for (const entity of game.queries.lifePickups) {
      void entity;
      return true;
    }

    return false;
  }

  function hasCoinPickup(): boolean {
    for (const entity of game.queries.coinPickups) {
      void entity;
      return true;
    }

    return false;
  }

  function getEntityById(entityId: EntityId): InteractiveEntity | null {
    for (const entity of game.ecsWorld.with("transform", "appearance", "physics", "movementDirection")) {
      if (entity.id === entityId) return entity;
    }

    return null;
  }

  function getEntityByBodyId(bodyId: PhysicsBodyId): PhysicsEntity | null {
    for (const entity of game.queries.physicsBodies) {
      if (entity.physics.bodyId === bodyId) return entity;
    }

    return null;
  }

  function findSpawnPosition(options: { padding: number; shape: Shape; size: number }): Vec2Value {
    const bounds = getWorldBounds();
    const radius = getShapeRadius(options.shape, options.size);
    const minX = radius + WALL_THICKNESS + 0.2;
    const maxX = bounds.width - radius - WALL_THICKNESS - 0.2;
    const minY = radius + WALL_THICKNESS + 0.2;
    const maxY = bounds.height - radius - WALL_THICKNESS - 0.2;
    const blockers = [...game.queries.physicsBodies];

    for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt += 1) {
      const candidate = {
        x: randomRange(minX, Math.max(minX, maxX)),
        y: randomRange(minY, Math.max(minY, maxY)),
      };
      let overlaps = false;

      for (const other of blockers) {
        const distance = Math.hypot(candidate.x - other.transform.x, candidate.y - other.transform.y);
        const minDistance = radius + other.physics.radius + options.padding;

        if (distance < minDistance) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        return candidate;
      }
    }

    return {
      x: randomRange(minX, Math.max(minX, maxX)),
      y: randomRange(minY, Math.max(minY, maxY)),
    };
  }

  function createFigureEntity(options: {
    role: "player" | "target" | "lifePickup" | "coinPickup";
    appearance?: Appearance | null;
    safeForAppearance?: Appearance | null;
    spawnPadding?: number;
  }): GameEntity {
    const isPlayer = options.role === "player";
    const isLifePickup = options.role === "lifePickup";
    const isCoinPickup = options.role === "coinPickup";
    const profile = getGameplayProfile();
    const spawnPadding = options.spawnPadding ?? profile.spawnPadding;
    const nextAppearance: Appearance = options.appearance ?? {
      ...(
        isLifePickup
          ? createLifePickupAppearance()
          : isCoinPickup
            ? createCoinPickupAppearance()
            : createEntityProperties(options.safeForAppearance ?? null)
      ),
      size: isLifePickup ? LIFE_ENTITY_SIZE : isCoinPickup ? COIN_ENTITY_SIZE : ENTITY_SIZE,
    };
    const initialDirection = getRandomDirection();

    const entity: InteractiveEntity & ({ player: true } | { target: true } | { lifePickup: true } | { coinPickup: true }) = {
      id: game.nextEntityId++,
      transform: { x: 0, y: 0, angle: 0 },
      appearance: nextAppearance,
      physics: {
        bodyId: -1,
        radius: getShapeRadius(nextAppearance.shape, nextAppearance.size),
      },
      movementDirection: initialDirection,
      renderable: true,
      ...(isPlayer ? { player: true } : isLifePickup ? { lifePickup: true } : isCoinPickup ? { coinPickup: true } : { target: true }),
    };

    const spawn = findSpawnPosition({
      padding: spawnPadding,
      shape: nextAppearance.shape,
      size: nextAppearance.size,
    });

    const adapter = game.physicsAdapter;
    if (!adapter) {
      throw new Error("Physics adapter is not initialized");
    }

    const bodyId = adapter.createDynamicBody({
      entityId: entity.id,
      position: spawn,
      angle: randomRange(0, Math.PI * 2),
      linearDamping: LINEAR_DAMPING,
      angularDamping: ANGULAR_DAMPING,
      bullet: true,
      shape: nextAppearance.shape,
      size: nextAppearance.size,
      velocity: {
        x: initialDirection.x * (isPlayer ? profile.playerSpeed : profile.targetSpeed),
        y: initialDirection.y * (isPlayer ? profile.playerSpeed : profile.targetSpeed),
      },
      angularVelocity: randomRange(-1.4, 1.4),
    });

    entity.physics.bodyId = bodyId;
    entity.transform.x = spawn.x;
    entity.transform.y = spawn.y;
    game.ecsWorld.add(entity);
    return entity;
  }

  function destroyFigureEntity(entity: AppearancePhysicsEntity): void {
    game.physicsAdapter?.destroyBody(entity.physics.bodyId);
    game.ecsWorld.remove(entity);
  }

  function clearGameplayEntities(): void {
    const removableEntities = [...game.queries.physicsBodies];

    for (const entity of removableEntities) {
      game.physicsAdapter?.destroyBody(entity.physics.bodyId);
      game.ecsWorld.remove(entity);
    }
  }

  function PhysicsCommandSystem(): void {
    while (game.queues.physics.length > 0) {
      const command = game.queues.physics.shift();
      if (!command) continue;

      executePhysicsCommand(command);
    }
  }

  function PhysicsStepSystem(): void {
    if (game.state !== "playing") return;
    game.physicsAdapter?.step(FIXED_DT);
  }

  function VelocityNormalizationSystem(): void {
    for (const entity of game.queries.physicsBodies) {
      const velocity = game.physicsAdapter?.getVelocity(entity.physics.bodyId) ?? null;
      if (!velocity) continue;

      const speed = getEntitySpeed(entity);
      const normalizedVelocity = normalizeVector(velocity);
      if (normalizedVelocity) {
        // After collisions we keep the rebound heading, then restore the fixed speed magnitude.
        setEntityMovementDirection(entity, normalizedVelocity);
        game.physicsAdapter?.setSpeedAlongDirection(entity.physics.bodyId, normalizedVelocity, speed);
        continue;
      }

      game.physicsAdapter?.setSpeedAlongDirection(entity.physics.bodyId, entity.movementDirection, speed);
    }
  }

  function syncTransformsFromPhysics(): void {
    for (const entity of game.queries.physicsBodies) {
      const transform = game.physicsAdapter?.readTransform(entity.physics.bodyId) ?? null;
      if (!transform) continue;
      entity.transform.x = transform.x;
      entity.transform.y = transform.y;
      entity.transform.angle = transform.angle;
    }
  }

  function TransformSyncSystem(): void {
    syncTransformsFromPhysics();
  }

  function CollisionCollectSystem(): void {
    const rawEvents = game.physicsAdapter?.drainCollisionEvents() ?? [];
    game.queues.collisionEvents.length = 0;

    if (rawEvents.length === 0) return;

    const uniquePairs = new Set<string>();

    for (const rawEvent of rawEvents) {
      const entityA = getEntityByBodyId(rawEvent.bodyIdA);
      const entityB = getEntityByBodyId(rawEvent.bodyIdB);
      if (!entityA || !entityB) continue;

      const playerEntity = entityA.player ? entityA : entityB.player ? entityB : null;
      if (!playerEntity) continue;

      const targetEntity = entityA.target ? entityA : entityB.target ? entityB : null;
      const lifeEntity = entityA.lifePickup ? entityA : entityB.lifePickup ? entityB : null;
      const coinEntity = entityA.coinPickup ? entityA : entityB.coinPickup ? entityB : null;
      if (!targetEntity && !lifeEntity && !coinEntity) continue;

      const pairKey = `${playerEntity.id}:${
        targetEntity?.id
        ?? (lifeEntity ? `life:${lifeEntity.id}` : coinEntity ? `coin:${coinEntity.id}` : "unknown")
      }`;
      if (uniquePairs.has(pairKey)) continue;

      uniquePairs.add(pairKey);

      if (targetEntity) {
        game.queues.collisionEvents.push({
          type: "player-target",
          playerId: playerEntity.id,
          targetId: targetEntity.id,
        });
        continue;
      }

      if (lifeEntity) {
        game.queues.collisionEvents.push({
          type: "player-life",
          playerId: playerEntity.id,
          lifeId: lifeEntity.id,
        });
        continue;
      }

      if (coinEntity) {
        game.queues.collisionEvents.push({
          type: "player-coin",
          playerId: playerEntity.id,
          coinId: coinEntity.id,
        });
      }
    }
  }

  function RuleResolutionSystem(): void {
    if (game.state !== "playing") {
      game.queues.collisionEvents.length = 0;
      return;
    }

    while (game.queues.collisionEvents.length > 0) {
      const collision = game.queues.collisionEvents.shift();
      if (!collision) continue;

      if (collision.type === "player-life") {
        game.queues.gameplay.push({
          type: "collect-life",
          playerId: collision.playerId,
          lifeId: collision.lifeId,
        });
        continue;
      }

      if (collision.type === "player-coin") {
        game.queues.gameplay.push({
          type: "collect-coin",
          playerId: collision.playerId,
          coinId: collision.coinId,
        });
        continue;
      }

      const player = getEntityById(collision.playerId);
      const target = getEntityById(collision.targetId);
      if (!player || !target) continue;

      if (areAllPropertiesDifferent(player.appearance, target.appearance)) {
        game.queues.gameplay.push({
          type: "consume-target",
          playerId: player.id,
          targetId: target.id,
        });
        continue;
      }

      if (game.lives > 1) {
        game.queues.gameplay.push({
          type: "lose-life",
          playerId: player.id,
          targetId: target.id,
        });
      } else {
        game.queues.gameplay.push({ type: "game-over" });
      }
      break;
    }
  }

  function GameplayMutationSystem(): void {
    while (game.queues.gameplay.length > 0) {
      const command = game.queues.gameplay.shift();
      if (!command) continue;

      if (command.type === "consume-target") {
        if (game.state !== "playing") continue;

        const player = getEntityById(command.playerId);
        const target = getEntityById(command.targetId);
        if (!player || !target) continue;

        player.appearance.shape = target.appearance.shape;
        player.appearance.color = target.appearance.color;
        player.appearance.fillStyle = target.appearance.fillStyle;
        player.physics.radius = getShapeRadius(player.appearance.shape, player.appearance.size);

        game.physicsAdapter?.setShape(player.physics.bodyId, {
          shape: player.appearance.shape,
          size: player.appearance.size,
        });

        destroyFigureEntity(target);
        game.score += 1;
        updateHud();

        if (!hasLifePickup() && Math.random() < getGameplayProfile().lifeSpawnChance) {
          game.queues.spawns.push({ type: "spawn-life" });
        }

        if (!hasCoinPickup() && Math.random() < getGameplayProfile().coinSpawnChance) {
          game.queues.spawns.push({ type: "spawn-coin" });
        }
      }

      if (command.type === "lose-life") {
        if (game.state !== "playing") continue;

        const target = getEntityById(command.targetId);
        if (target) {
          destroyFigureEntity(target);
        }

        game.lives = Math.max(0, game.lives - 1);
        game.damageInvulnerabilityExpiresAt = performance.now() + DAMAGE_INVULNERABILITY_MS;
        game.queues.collisionEvents.length = 0;
        updateHud();
      }

      if (command.type === "collect-life") {
        if (game.state !== "playing") continue;

        const lifeEntity = getEntityById(command.lifeId);
        if (!lifeEntity?.lifePickup) continue;

        destroyFigureEntity(lifeEntity);

        if (game.lives < game.maxLives) {
          game.lives += 1;
        } else {
          pulseLivesHud();
        }

        updateHud();
      }

      if (command.type === "collect-coin") {
        if (game.state !== "playing") continue;

        const coinEntity = getEntityById(command.coinId);
        if (!coinEntity?.coinPickup) continue;

        destroyFigureEntity(coinEntity);
        game.coins += 1;
        pulseCoinsHud();
        updateHud();
      }

      if (command.type === "game-over") {
        const previousBestScore = game.bestScore;
        const finalScore = game.score + game.coins * COIN_BONUS_MULTIPLIER;
        const isFirstBestScore = previousBestScore === null;
        const isNewBestScore = previousBestScore !== null && finalScore > previousBestScore;

        if (isFirstBestScore || isNewBestScore) {
          game.bestScore = finalScore;
          saveBestScore(finalScore);
        }

        game.lastRoundBaseScore = game.score;
        game.lastRoundCoinBonus = game.coins * COIN_BONUS_MULTIPLIER;
        game.lastRoundFinalScore = finalScore;
        game.lastRoundBestScore = isFirstBestScore ? finalScore : Math.max(previousBestScore ?? 0, finalScore);
        game.lastGameOverWasNewBest = isNewBestScore;
        game.previousBestScoreBeforeGameOver = isNewBestScore ? previousBestScore : null;
        game.gameOverInstallPrompt = pwa.consumeGameOverInstallPrompt();
        game.state = "gameOver";
        clearInputState();
        clearActiveTouchInputs();
        game.queues.physics.length = 0;
        game.queues.collisionEvents.length = 0;
        game.accumulator = 0;
        game.damageInvulnerabilityExpiresAt = 0;
        showGameOverOverlay();
        updateHud();
      }
    }
  }

  function SpawnPlanningSystem(): void {
    if (game.state !== "playing") return;

    const desiredTargetCount = getDesiredTargetCount(game.score);
    const currentTargetCount = getTargetCount();

    for (let count = currentTargetCount; count < desiredTargetCount; count += 1) {
      game.queues.spawns.push({
        type: "spawn-target",
        safeForPlayer: false,
      });
    }

    const player = getPlayerEntity();
    if (!player) return;

    let hasSafeTarget = false;

    for (const target of game.queries.targets) {
      if (areAllPropertiesDifferent(player.appearance, target.appearance)) {
        hasSafeTarget = true;
        break;
      }
    }

    if (!hasSafeTarget) {
      game.queues.spawns.push({
        type: "spawn-target",
        safeForPlayer: true,
        safeAppearance: player.appearance,
      });
    }
  }

  function SpawnApplySystem(): void {
    while (game.queues.spawns.length > 0) {
      const request = game.queues.spawns.shift();
      if (!request) continue;

      if (request.type === "spawn-target") {
        createFigureEntity({
          role: "target",
          safeForAppearance: request.safeForPlayer ? request.safeAppearance ?? null : null,
          spawnPadding: request.safeForPlayer ? getGameplayProfile().safeSpawnPadding : getGameplayProfile().spawnPadding,
        });
        continue;
      }

      if (request.type === "spawn-life" && !hasLifePickup()) {
        createFigureEntity({
          role: "lifePickup",
          spawnPadding: getGameplayProfile().safeSpawnPadding,
        });
        continue;
      }

      if (request.type === "spawn-coin" && !hasCoinPickup()) {
        createFigureEntity({
          role: "coinPickup",
          spawnPadding: getGameplayProfile().safeSpawnPadding,
        });
      }
    }
  }

  function traceShape(shape: Shape, size: number): void {
    ctx.beginPath();

    if (shape === "circle") {
      ctx.arc(0, 0, size * SCALE, 0, Math.PI * 2);
      return;
    }

    if (shape === "square") {
      const pixelSize = size * SCALE;
      ctx.rect(-pixelSize, -pixelSize, pixelSize * 2, pixelSize * 2);
      return;
    }

    const vertices = getTriangleVertices(size);
    ctx.moveTo(vertices[0]!.x * SCALE, -vertices[0]!.y * SCALE);
    for (let index = 1; index < vertices.length; index += 1) {
      const vertex = vertices[index]!;
      ctx.lineTo(vertex.x * SCALE, -vertex.y * SCALE);
    }
    ctx.closePath();
  }

  function drawPlayerMarker(): void {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawLifePickup(size: number): void {
    const unitScale = (size * SCALE * 0.96) / 10;
    const diamondPoints = getLifeDiamondPoints(unitScale);
    const crossSegments = getLifeCrossSegments(unitScale);

    ctx.beginPath();
    ctx.moveTo(diamondPoints[0]!.x, diamondPoints[0]!.y);
    for (let index = 1; index < diamondPoints.length; index += 1) {
      const point = diamondPoints[index]!;
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.stroke();

    for (const segment of crossSegments) {
      ctx.beginPath();
      ctx.moveTo(segment.from.x, segment.from.y);
      ctx.lineTo(segment.to.x, segment.to.y);
      ctx.stroke();
    }
  }

  function drawCoinPickup(size: number): void {
    const unitScale = (size * SCALE * 1.05) / 10;
    const hexagonPoints = getCoinHexagonPoints(unitScale);
    const spokes = getCoinSpokes(unitScale);

    ctx.beginPath();
    for (let index = 0; index < hexagonPoints.length; index += 1) {
      const point = hexagonPoints[index]!;
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, getCoinInnerRadius(unitScale), 0, Math.PI * 2);
    ctx.stroke();

    for (const spoke of spokes) {
      ctx.beginPath();
      ctx.moveTo(spoke.from.x, spoke.from.y);
      ctx.lineTo(spoke.to.x, spoke.to.y);
      ctx.stroke();
    }
  }

  function drawEntity(entity: RenderableEntity): void {
    const { x, y } = worldToCanvas(entity.transform.x, entity.transform.y);
    const color = entity.lifePickup ? LIFE_COLOR : entity.coinPickup ? COIN_COLOR : COLOR_MAP[entity.appearance.color];
    const isInvulnerablePlayer = entity.player && isDamageInvulnerabilityActive();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-entity.transform.angle);
    ctx.lineWidth = entity.player ? 4.5 : entity.lifePickup ? 2.8 : entity.coinPickup ? 2.4 : 2.2;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.setLineDash(entity.lifePickup || entity.coinPickup ? [] : entity.appearance.fillStyle === "dashed" ? [9, 6] : []);

    if (entity.lifePickup) {
      ctx.shadowColor = "rgba(184, 148, 255, 0.4)";
      ctx.shadowBlur = 14;
      drawLifePickup(entity.appearance.size);
    } else if (entity.coinPickup) {
      ctx.shadowColor = "rgba(255, 209, 102, 0.46)";
      ctx.shadowBlur = 18;
      drawCoinPickup(entity.appearance.size);
    } else {
      traceShape(entity.appearance.shape, entity.appearance.size);

      if (entity.appearance.fillStyle === "filled") {
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
      } else {
        ctx.stroke();
      }
    }

    ctx.setLineDash([]);

    if (entity.player) {
      if (isInvulnerablePlayer && Math.floor(performance.now() / 90) % 2 === 0) {
        traceShape(entity.appearance.shape, entity.appearance.size * 1.18);
        ctx.strokeStyle = "#ffd166";
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
      drawPlayerMarker();
    }

    ctx.restore();
  }

  function RenderSystem(): void {
    const metrics = getCanvasMetrics();
    ctx.clearRect(0, 0, metrics.widthCss, metrics.heightCss);

    for (const entity of game.queries.renderables) {
      drawEntity(entity);
    }
  }

  function resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const viewport = getViewportSize();
    const widthCss = viewport.width;
    const heightCss = viewport.height;
    const widthPx = Math.floor(widthCss * dpr);
    const heightPx = Math.floor(heightCss * dpr);

    syncViewportCssVars(widthCss, heightCss);
    game.canvasMetrics.dpr = dpr;
    game.canvasMetrics.widthCss = widthCss;
    game.canvasMetrics.heightCss = heightCss;
    game.canvasMetrics.widthPx = widthPx;
    game.canvasMetrics.heightPx = heightPx;
    updateGameplayProfile();

    canvas.style.width = `${widthCss}px`;
    canvas.style.height = `${heightCss}px`;

    if (canvas.width !== widthPx || canvas.height !== heightPx) {
      canvas.width = widthPx;
      canvas.height = heightPx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    if (game.physicsAdapter && game.state !== "boot") {
      const dynamicBodies = [...game.queries.physicsBodies].map((entity) => ({
        bodyId: entity.physics.bodyId,
        radius: entity.physics.radius,
        x: entity.transform.x,
        y: entity.transform.y,
      }));

      game.physicsAdapter.resizeBounds(getWorldBounds(), dynamicBodies);
      syncTransformsFromPhysics();
    }
  }

  function resetRuntime(): void {
    game.physicsAdapter?.destroyWorld();
    game.physicsAdapter = createPhysicsAdapter();
    game.physicsAdapter.createWorld(getWorldBounds());
    game.physicsAdapter.setContactPassThroughPredicate((bodyIdA, bodyIdB) => {
      const player = getPlayerEntity();
      if (!player) return false;
      const playerBodyId = player.physics.bodyId;
      const otherBodyId =
        bodyIdA === playerBodyId ? bodyIdB : bodyIdB === playerBodyId ? bodyIdA : null;
      if (otherBodyId === null) return false;

      if (isDamageInvulnerabilityActive()) {
        return true;
      }

      for (const lifePickup of game.queries.lifePickups) {
        if (lifePickup.physics.bodyId === otherBodyId) {
          return true;
        }
      }

      for (const coinPickup of game.queries.coinPickups) {
        if (coinPickup.physics.bodyId === otherBodyId) {
          return true;
        }
      }

      for (const target of game.queries.targets) {
        if (target.physics.bodyId === otherBodyId) {
          return areAllPropertiesDifferent(player.appearance, target.appearance);
        }
      }
      return false;
    });
    clearGameplayEntities();
    updateGameplayProfile();
    game.score = 0;
    game.coins = 0;
    game.lives = getGameplayProfile().startLives;
    game.maxLives = getGameplayProfile().maxLives;
    game.lastGameOverWasNewBest = false;
    game.previousBestScoreBeforeGameOver = null;
    game.lastRoundBaseScore = 0;
    game.lastRoundCoinBonus = 0;
    game.lastRoundFinalScore = 0;
    game.lastRoundBestScore = null;
    game.gameOverInstallPrompt = null;
    game.nextEntityId = 1;
    game.accumulator = 0;
    game.lastFrameTime = performance.now();
    game.state = "playing";
    game.queues = createQueues();
    game.playerBoostExpiresAt = 0;
    game.damageInvulnerabilityExpiresAt = 0;
    delete hudCoins.dataset.pulse;
    if (hudCoinsPulseTimeoutId !== null) {
      window.clearTimeout(hudCoinsPulseTimeoutId);
      hudCoinsPulseTimeoutId = null;
    }
    clearInputState();
    clearActiveTouchInputs();
    hideOverlay();
    updateHud();
  }

  function seedWorld(): void {
    createFigureEntity({ role: "player" });
    const desiredTargetCount = getDesiredTargetCount(0);
    const profile = getGameplayProfile();
    const startPadding = profile.compactTouch ? profile.safeSpawnPadding : profile.spawnPadding;

    for (let index = 0; index < desiredTargetCount; index += 1) {
      createFigureEntity({
        role: "target",
        spawnPadding: startPadding,
      });
    }
  }

  function restartGame(): void {
    resetRuntime();
    seedWorld();
  }

  const FIXED_TICK_SYSTEMS: Array<() => void> = [
    PhysicsCommandSystem,
    PhysicsStepSystem,
    VelocityNormalizationSystem,
    TransformSyncSystem,
    CollisionCollectSystem,
    RuleResolutionSystem,
    GameplayMutationSystem,
    SpawnPlanningSystem,
    SpawnApplySystem,
    TransformSyncSystem,
  ];

  function fixedUpdate(): void {
    for (const system of FIXED_TICK_SYSTEMS) {
      system();
    }
  }

  function frame(now: number): void {
    const elapsed = Math.min((now - game.lastFrameTime) / 1000, MAX_FRAME_DT);
    game.lastFrameTime = now;

    if (game.state === "playing") {
      game.accumulator += elapsed;

      while (game.accumulator >= FIXED_DT) {
        fixedUpdate();
        game.accumulator -= FIXED_DT;
      }
    } else {
      game.accumulator = 0;
    }

    RenderSystem();
    requestAnimationFrame(frame);
  }

  function setGameUiVisible(visible: boolean): void {
    canvas.classList.toggle("app-hidden", !visible);
    hud.classList.toggle("app-hidden", !visible);
    overlay.classList.toggle("app-hidden", !visible);
  }

  function startGameSession(): void {
    scheduleInitialFullscreenAttempt();
    restartGame();
    hasInitializedGameSession = true;

    continueEntryOverlayFlow();
  }

  export function enterSettingsPage(): void {
    isGameRouteActive = false;
    pwa.setGameRouteActive(false);
    setGameUiVisible(false);

    if (game.state === "playing") {
      pauseGame(true);
    }
  }

  export function enterGamePage(): void {
    isGameRouteActive = true;
    pwa.setGameRouteActive(true);
    setGameUiVisible(true);

    if (!hasInitializedGameSession || shouldRestartGameOnNextGameRoute) {
      shouldRestartGameOnNextGameRoute = false;
      startGameSession();
      return;
    }

    updateHud();
  }

  function setInputKey(key: string, isPressed: boolean): void {
    if (key === "arrowup" || key === "w") setDirectionalInput("up", isPressed);
    if (key === "arrowdown" || key === "s") setDirectionalInput("down", isPressed);
    if (key === "arrowleft" || key === "a") setDirectionalInput("left", isPressed);
    if (key === "arrowright" || key === "d") setDirectionalInput("right", isPressed);
  }

  window.addEventListener("keydown", (event) => {
    if (!isGameRouteActive) return;

    const key = event.key.toLowerCase();
    if (key === PAUSE_KEY) {
      event.preventDefault();
      togglePauseGame();
      return;
    }

    if (!DIRECTIONAL_KEYS.has(key) || game.state !== "playing") return;
    event.preventDefault();
    setInputKey(key, true);
    refreshPlayerDirectionFromKeyboard();
  });

  window.addEventListener("keyup", (event) => {
    if (!isGameRouteActive) return;

    const key = event.key.toLowerCase();
    if (!DIRECTIONAL_KEYS.has(key)) return;
    event.preventDefault();
    setInputKey(key, false);
    refreshPlayerDirectionFromKeyboard();
  });

  window.addEventListener("blur", () => {
    clearInputState();
    clearActiveTouchInputs();
    pauseGame(true);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearInputState();
      clearActiveTouchInputs();
      pauseGame(true);
    }
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
  });
  window.addEventListener("orientationchange", () => {
    resizeCanvas();
  });
  window.visualViewport?.addEventListener("resize", () => {
    resizeCanvas();
  });
  window.visualViewport?.addEventListener("scroll", () => {
    resizeCanvas();
  });
  document.addEventListener("fullscreenchange", () => {
    resizeCanvas();
  });
  document.addEventListener("webkitfullscreenchange", () => {
    resizeCanvas();
  });

  pauseButton.addEventListener("click", () => {
    retryFullscreenOnUserGesture();
    togglePauseGame();
  });

  overlayPrimaryButton.addEventListener("click", () => {
    retryFullscreenOnUserGesture();

    if (overlayMode === "install") {
      void pwa.confirmOverlay().then(applyOverlayFlowResult);
      return;
    }

    if (overlayMode === "onboarding") {
      setRulesAccepted();
      resumeGame();
      return;
    }

    if (overlayMode === "pause") {
      resumeGame();
      return;
    }

    if (overlayMode === "gameOver") {
      restartGame();
    }
  });

  overlaySecondaryButton.addEventListener("click", () => {
    retryFullscreenOnUserGesture();

    if (overlayMode === "install") {
      applyOverlayFlowResult(pwa.dismissOverlay());
      return;
    }

    if (overlayMode === "pause") {
      openSettingsListener?.();
      return;
    }

    restartGame();
  });

  overlayInstallButton.addEventListener("click", () => {
    retryFullscreenOnUserGesture();

    if (overlayMode !== "pause") {
      return;
    }

    void pwa.openInstallFlow("pause").then(applyOverlayFlowResult);
  });

  overlayFooterButton.addEventListener("click", () => {
    retryFullscreenOnUserGesture();

    if (overlayMode !== "gameOver") {
      return;
    }

    void pwa.openInstallFlow("postGameOver").then(applyOverlayFlowResult);
  });

  let lastPointerDownTime = 0;
  let lastPointerDownX = 0;
  let lastPointerDownY = 0;

  canvas.addEventListener("pointerdown", (event) => {
    retryFullscreenOnUserGesture();
    if (!isGameRouteActive) return;
    if (game.state !== "playing") return;

    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();

    const now = event.timeStamp || performance.now();
    const elapsed = now - lastPointerDownTime;
    const isDoubleTap =
      elapsed > 0 &&
      elapsed < DOUBLE_TAP_WINDOW_MS &&
      Math.abs(event.clientX - lastPointerDownX) < DOUBLE_TAP_RADIUS_PX &&
      Math.abs(event.clientY - lastPointerDownY) < DOUBLE_TAP_RADIUS_PX;
    lastPointerDownTime = now;
    lastPointerDownX = event.clientX;
    lastPointerDownY = event.clientY;

    if (isDoubleTap) {
      game.playerBoostExpiresAt = performance.now() + PLAYER_BOOST_DURATION_MS;
    }

    setPointerDirection(event.clientX, event.clientY);
  });

  installBrowserInteractionGuards();
  installDoubleTapZoomGuard(modal);
  subscribeToPwaStateChanges(() => {
    updateHud();

    if (overlayMode === "pause") {
      showPauseOverlay(false);
      return;
    }

    if (overlayMode === "install") {
      if (game.state === "gameOver") {
        showGameOverOverlay();
      } else if (game.state === "paused") {
        showPauseOverlay(false);
      } else {
        hideOverlay();
      }
    }
  });

  export function initializeGame(): void {
    resizeCanvas();
    initializeSettingsState(loadSavedGameplaySettings());
    updateGameplayProfile(true);
    game.bestScore = loadBestScore();
    pwa.initialize();

    if (!hasStartedFrameLoop) {
      hasStartedFrameLoop = true;
      requestAnimationFrame(frame);
    }
  }
