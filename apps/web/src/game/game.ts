import {
  loadSavedGameplaySettings,
} from "./gameplay-settings.ts";
import {
  getShapeRadius,
  normalizeVector,
  WALL_THICKNESS,
  type Vector2,
} from "./game-geometry.ts";
import { createPlanckPhysicsAdapter } from "./planck-physics-adapter.ts";
import {
  createPwaController,
  subscribeToPwaStateChanges,
  type PwaActionResult,
  type PwaInstallOverlayModel,
} from "../platform/pwa.ts";
import {
  createCanvasRenderer,
  type CanvasRenderer,
} from "./canvas-renderer.ts";
import {
  createBrowserGameInput,
  type BrowserGameInputEvent,
} from "./browser-game-input.ts";
import type { DomGameUi, DomGameUiEvent } from "./dom-game-ui.ts";
import {
  flushAnalyticsEvents,
  getAnalyticsSessionId,
  startAnalyticsRound,
  trackAnalyticsEvent,
  type AnalyticsEventType,
  type AnalyticsPayload,
} from "../platform/analytics-client.ts";
import { getCurrentRoute } from "../platform/router.ts";
import type {
  GameReadModel,
  GameReadModelEntity,
  GameReadModelSettings,
} from "./game-read-model.ts";
import type { AppReadModel } from "../app/app-read-model.ts";
import { buildAppReadModel } from "../app/app-read-model-builder.ts";
import {
  buildGameReadModel,
  buildSettingsReadModel,
  collectEntityReadModels,
  createEntityReadModel,
} from "./game-read-model-builder.ts";
import {
  createGameplayProfile,
  createSettingsEntityFromSavedSettings,
  getGameplayProfileKey,
  resolveGameplayProfile,
  syncSettingsStateWithProfile,
} from "./gameplay-profile.ts";
import {
  configureSettingsController,
  notifySettingsStateListeners,
} from "../settings/settings-controller.ts";
import {
  createQueues,
  createRuntime,
  type Appearance,
  type AppearancePhysicsEntity,
  type Bounds,
  type CanvasMetrics,
  type ColorName,
  type EntityId,
  type FillStyleName,
  type GameEntity,
  type GameplayProfile,
  type InputKey,
  type InteractiveEntity,
  type MovementDirection,
  type OverlayMode,
  type PhysicsBodyId,
  type PhysicsCommand,
  type PhysicsEntity,
  type PlayerEntity,
  type SettingsEntity,
  type Shape,
} from "./game-runtime.ts";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type OpenSettingsListener = () => void;

export type GameDomDependencies = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  ui: DomGameUi;
  rootStyle: CSSStyleDeclaration;
};

const SCALE = 30;
const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 1 / 24;
const MIN_POINTER_TARGET_DISTANCE = 10;
const PLAYER_BOOST_DURATION_MS = 350;
const DAMAGE_INVULNERABILITY_MS = 900;
const LINEAR_DAMPING = 0;
const ANGULAR_DAMPING = 0.6;
const ENTITY_SIZE = 0.55;
const LIFE_ENTITY_SIZE = 0.42;
const COIN_ENTITY_SIZE = 0.4;
const COIN_BONUS_MULTIPLIER = 2;
const MAX_SPAWN_ATTEMPTS = 80;
const SHAPES: Shape[] = ["circle", "square", "triangle"];
const COLORS: ColorName[] = ["red", "blue", "green"];
const FILL_STYLES: FillStyleName[] = ["filled", "outline", "dashed"];
const RULES_STORAGE_KEY = "shapes-game.rulesAccepted";
const BEST_SCORE_STORAGE_KEY = "shapes-game.bestScore";
const GAME_RULES = [
  "Клик, тап или клавиши мгновенно меняют направление, скорость всегда остается постоянной.",
  "Съедать можно только фигуры, которые отличаются по всем трем свойствам.",
  "Если совпадает хотя бы одно свойство, теряется жизнь. Забег заканчивается, когда жизни кончаются.",
];
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let canvasRenderer: CanvasRenderer;
let ui: DomGameUi;
let rootStyle: CSSStyleDeclaration;
const pwa = createPwaController();
let openSettingsListener: OpenSettingsListener | null = null;
const game = createRuntime({
  createGameplayProfile,
  startRound: startAnalyticsRound,
  now: () => performance.now(),
});
let overlayMode: OverlayMode = null;
let shouldRetryFullscreen = true;
let hasStartedFrameLoop = false;
let hasInitializedGameSession = false;
let hasInstalledDomBindings = false;
let shouldRestartGameOnNextGameRoute = false;
let isGameRouteActive = false;
let lastPauseWasAutoPaused = false;

function getSettingsEntity(): SettingsEntity | null {
  for (const entity of game.queries.settings) {
    return entity;
  }

  return null;
}

export function getSettingsReadModel(): GameReadModelSettings | null {
  return buildSettingsReadModel(getSettingsEntity());
}

export function getPlayerModel(): GameReadModelEntity | null {
  const player = getPlayerEntity();
  return player ? createEntityReadModel(player) : null;
}

export function getTargetModels(): GameReadModelEntity[] {
  return collectEntityReadModels(game.queries.targets);
}

export function getLifePickupModels(): GameReadModelEntity[] {
  return collectEntityReadModels(game.queries.lifePickups);
}

export function getCoinPickupModels(): GameReadModelEntity[] {
  return collectEntityReadModels(game.queries.coinPickups);
}

export function getAppReadModel(): AppReadModel {
  const route = getCurrentRoute();
  return buildAppReadModel(route, getGameReadModel());
}

export function getGameReadModel(): GameReadModel {
  return buildGameReadModel({
    runtime: game,
    settings: getSettingsReadModel(),
    overlay: {
      mode: overlayMode,
      rules: GAME_RULES,
      lastPauseWasAutoPaused,
      activeInstallOverlay: pwa.getActiveOverlayModel(),
      pauseInstallButton: pwa.getPauseInstallButtonState(),
    },
  });
}

function renderApp(): void {
  ui.render(getAppReadModel());
}

function getGameplayProfile(): GameplayProfile {
  return game.gameplayProfile;
}

function getRoundElapsedMs(): number {
  return Math.max(0, Math.round(performance.now() - game.roundStartedAt));
}

function getSharedAnalyticsPayload(): AnalyticsPayload {
  const profile = getGameplayProfile();

  return {
    session_id: getAnalyticsSessionId(),
    round_id: game.roundId,
    profile_key: getGameplayProfileKey(profile),
    compact_touch: profile.compactTouch,
    score: game.score,
    coins: game.coins,
    lives: game.lives,
    max_lives: game.maxLives,
    elapsed_ms: getRoundElapsedMs(),
  };
}

function trackGameplayEvent(type: AnalyticsEventType, payload: AnalyticsPayload = {}): void {
  trackAnalyticsEvent(type, {
    ...getSharedAnalyticsPayload(),
    ...payload,
  });
}

function updateGameplayProfile(resetDraft = false): void {
  syncSettingsStateWithProfile(getSettingsEntity(), game.canvasMetrics, resetDraft);
  game.gameplayProfile = resolveGameplayProfile(getSettingsEntity(), game.canvasMetrics);
}

function initializeSettingsState(): void {
  game.ecsWorld.add(createSettingsEntityFromSavedSettings(game.canvasMetrics, loadSavedGameplaySettings()));
  notifySettingsStateListeners();
}

export function setOpenSettingsListener(listener: OpenSettingsListener): void {
  openSettingsListener = listener;
}

function setDirectionalInput(inputKey: InputKey, isPressed: boolean): void {
  game.input[inputKey] = isPressed;
}

function clearActiveTouchInputs(): void {
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

function setEntityMovementDirection(entity: PhysicsEntity, direction: Vector2): void {
  const normalizedDirection = normalizeVector(direction);
  if (!normalizedDirection) return;

  entity.movementDirection = normalizedDirection;
}

// Direct velocity assignment provides instant steering by overwriting accumulated momentum.
function setEntityVelocityAlongDirection(entity: PhysicsEntity, direction: Vector2): void {
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

  function randomItem<T>(items: readonly T[]): T {
    return items[Math.floor(Math.random() * items.length)] as T;
  }

  function randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
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

  function worldToCanvas(x: number, y: number): Vector2 {
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
  renderApp();
}

function showPauseOverlay(autoPaused: boolean): void {
  overlayMode = "pause";
  lastPauseWasAutoPaused = autoPaused;
  renderApp();
}

function showGameOverOverlay(): void {
  overlayMode = "gameOver";
  renderApp();
}

function hideOverlay(): void {
  overlayMode = null;
  renderApp();
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
  trackGameplayEvent("game.round_paused", {
    auto_paused: autoPaused,
  });
  void flushAnalyticsEvents();
}

function resumeGame(): void {
  if (game.state !== "paused") return;

  hideOverlay();
  clearInputState();
  clearActiveTouchInputs();
  game.accumulator = 0;
  game.lastFrameTime = performance.now();
  game.state = "playing";
  renderApp();
  trackGameplayEvent("game.round_resumed");
}

function startOnboarding(): void {
  game.state = "paused";
  game.accumulator = 0;
  game.lastFrameTime = performance.now();
  clearInputState();
  clearActiveTouchInputs();
  showOnboardingOverlay();
}

function showExternalOverlay(model: PwaInstallOverlayModel): void {
  overlayMode = "install";

  if (model.surface === "postGameOver") {
    game.accumulator = 0;
    clearInputState();
    clearActiveTouchInputs();
    renderApp();
    return;
  }

  game.state = "paused";
  game.accumulator = 0;
  game.lastFrameTime = performance.now();
  clearInputState();
  clearActiveTouchInputs();
  renderApp();
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
    return;
  }

  if (result.target === "gameOver") {
    showGameOverOverlay();
    return;
  }

  hideOverlay();
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

  function findSpawnPosition(options: { padding: number; shape: Shape; size: number }): Vector2 {
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
        renderApp();
        trackGameplayEvent("game.target_consumed", {
          score_delta: 1,
          targets_remaining: [...game.queries.targets].length,
        });

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
        renderApp();
        trackGameplayEvent("game.life_lost", {
          lives_lost: 1,
        });
      }

      if (command.type === "collect-life") {
        if (game.state !== "playing") continue;

        const lifeEntity = getEntityById(command.lifeId);
        if (!lifeEntity?.lifePickup) continue;

        destroyFigureEntity(lifeEntity);

        const livesBeforeCollection = game.lives;
        if (game.lives < game.maxLives) {
          game.lives += 1;
        }

        renderApp();
        trackGameplayEvent("game.life_collected", {
          lives_added: game.lives - livesBeforeCollection,
        });
      }

      if (command.type === "collect-coin") {
        if (game.state !== "playing") continue;

        const coinEntity = getEntityById(command.coinId);
        if (!coinEntity?.coinPickup) continue;

        destroyFigureEntity(coinEntity);
        game.coins += 1;
        renderApp();
        trackGameplayEvent("game.coin_collected", {
          coins_added: 1,
        });
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
        trackGameplayEvent("game.game_over", {
          base_score: game.lastRoundBaseScore,
          coin_bonus: game.lastRoundCoinBonus,
          final_score: game.lastRoundFinalScore,
          best_score: game.lastRoundBestScore,
          is_new_best: game.lastGameOverWasNewBest,
        });
        game.state = "gameOver";
        clearInputState();
        clearActiveTouchInputs();
        game.queues.physics.length = 0;
        game.queues.collisionEvents.length = 0;
        game.accumulator = 0;
        game.damageInvulnerabilityExpiresAt = 0;
        showGameOverOverlay();
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

  function renderSystem(): void {
    const metrics = getCanvasMetrics();
    const entities = getGameReadModel().scene.entities;

    canvasRenderer.render({
      metrics,
      entities,
      now: () => performance.now(),
      isDamageInvulnerable: (entity) => entity.kind === "player" && isDamageInvulnerabilityActive(),
    });
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
    game.physicsAdapter = createPlanckPhysicsAdapter();
    game.physicsAdapter.createWorld(getWorldBounds());
    game.physicsAdapter.setContactPassThroughPredicate((bodyIdA, bodyIdB) => {
      const player = getPlayerEntity();
      if (!player) return false;
      const playerBodyId = player.physics.bodyId;
      const otherBodyId =
        bodyIdA === playerBodyId ? bodyIdB : bodyIdB === playerBodyId ? bodyIdA : null;
      if (otherBodyId === null) return false;

      const otherEntity = getEntityByBodyId(otherBodyId);
      if (!otherEntity) return false;

      if (isDamageInvulnerabilityActive()) {
        return !!(otherEntity.target || otherEntity.lifePickup || otherEntity.coinPickup);
      }

      if (otherEntity.lifePickup || otherEntity.coinPickup) return true;
      return !!otherEntity.target;
    });
    clearGameplayEntities();
    updateGameplayProfile();
    game.score = 0;
    game.coins = 0;
    game.lives = getGameplayProfile().startLives;
    game.maxLives = getGameplayProfile().maxLives;
    game.roundId = startAnalyticsRound();
    game.roundStartedAt = performance.now();
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
    clearInputState();
    clearActiveTouchInputs();
    hideOverlay();
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
    const shouldTrackRestart = game.state !== "boot";

    if (shouldTrackRestart) {
      trackGameplayEvent("game.round_restarted");
    }

    resetRuntime();
    seedWorld();
    trackGameplayEvent("game.round_started", {
      target_count: [...game.queries.targets].length,
      start_lives: game.lives,
    });
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

    renderSystem();
    requestAnimationFrame(frame);
  }

  function startGameSession(): void {
    scheduleInitialFullscreenAttempt();
    restartGame();
    hasInitializedGameSession = true;

    continueEntryOverlayFlow();
  }

  export function enterNonGamePage(): void {
    isGameRouteActive = false;
    pwa.setGameRouteActive(false);
    renderApp();

    if (game.state === "playing") {
      pauseGame(true);
    }
  }

  export function enterSettingsPage(): void {
    enterNonGamePage();
  }

  export function enterGamePage(): void {
    isGameRouteActive = true;
    pwa.setGameRouteActive(true);
    renderApp();

    if (!hasInitializedGameSession || shouldRestartGameOnNextGameRoute) {
      shouldRestartGameOnNextGameRoute = false;
      startGameSession();
      return;
    }

    renderApp();
  }

  function installDomBindings(): void {
    if (hasInstalledDomBindings) return;
    hasInstalledDomBindings = true;

    function handleBrowserInputEvent(event: BrowserGameInputEvent): void {
      if (event.type === "user-gesture") {
        retryFullscreenOnUserGesture();
        return;
      }

      if (event.type === "pause-toggle-requested") {
        togglePauseGame();
        return;
      }

      if (event.type === "direction-key-changed") {
        setDirectionalInput(event.key, event.pressed);
        refreshPlayerDirectionFromKeyboard();
        return;
      }

      if (event.type === "pointer-aim-requested") {
        setPointerDirection(event.canvasX, event.canvasY);
        return;
      }

      if (event.type === "player-boost-requested") {
        game.playerBoostExpiresAt = performance.now() + PLAYER_BOOST_DURATION_MS;
        return;
      }

      if (event.type === "auto-pause-requested") {
        clearInputState();
        clearActiveTouchInputs();
        pauseGame(true);
        return;
      }

      if (event.type === "viewport-change-requested" || event.type === "fullscreen-change-requested") {
        resizeCanvas();
      }
    }

    const browserInput = createBrowserGameInput({
      canvas,
      modal: ui.modal,
      window,
      document,
      visualViewport: window.visualViewport,
      now: () => performance.now(),
      isGameRouteActive: () => isGameRouteActive,
      isGamePlaying: () => game.state === "playing",
    });
    browserInput.subscribe(handleBrowserInputEvent);
    browserInput.install();

    function handleUiEvent(event: DomGameUiEvent): void {
      retryFullscreenOnUserGesture();

      if (event.type === "pause-toggle") {
        togglePauseGame();
        return;
      }

      if (event.type === "open-install-flow") {
        void pwa.openInstallFlow(event.surface).then(applyOverlayFlowResult);
        return;
      }

      if (event.action === "confirmInstall") {
        if (overlayMode === "gameOver") {
          void pwa.openInstallFlow("postGameOver").then(applyOverlayFlowResult);
          return;
        }

        void pwa.confirmOverlay().then(applyOverlayFlowResult);
        return;
      }

      if (event.action === "dismissInstall") {
        applyOverlayFlowResult(pwa.dismissOverlay());
        return;
      }

      if (event.action === "acceptOnboarding") {
        setRulesAccepted();
        resumeGame();
        return;
      }

      if (event.action === "resume") {
        resumeGame();
        return;
      }

      if (event.action === "openSettings") {
        openSettingsListener?.();
        return;
      }

      if (event.action === "restart") {
        restartGame();
      }
    }

    ui.subscribe(handleUiEvent);
    subscribeToPwaStateChanges(() => {
      renderApp();

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
  }

  export function initializeGame(dependencies: GameDomDependencies): void {
    canvas = dependencies.canvas;
    ctx = dependencies.context;
    canvasRenderer = createCanvasRenderer({ context: ctx, scale: SCALE });
    ui = dependencies.ui;
    rootStyle = dependencies.rootStyle;
    configureSettingsController({
      getSettingsEntity,
      onPersistActiveProfileSettings() {
        updateGameplayProfile(true);
        shouldRestartGameOnNextGameRoute = true;
      },
    });
    installDomBindings();
    resizeCanvas();
    initializeSettingsState();
    updateGameplayProfile(true);
    game.bestScore = loadBestScore();
    pwa.initialize();

    if (!hasStartedFrameLoop) {
      hasStartedFrameLoop = true;
      requestAnimationFrame(frame);
    }
  }
