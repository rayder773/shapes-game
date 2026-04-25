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

type Shape = "circle" | "square" | "triangle";
type ColorName = "red" | "blue" | "green";
type FillStyleName = "filled" | "outline" | "dashed";
type InputKey = "up" | "down" | "left" | "right";
type PhysicsBodyKind = "entity" | "wall";
type GameState = "boot" | "playing" | "paused" | "gameOver";
type OverlayMode = "onboarding" | "pause" | "gameOver" | null;

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

type GameEntity = {
  id: EntityId;
  transform?: Transform;
  appearance?: Appearance;
  physics?: PhysicsComponent;
  renderable?: true;
  player?: true;
  target?: true;
};

type InputSnapshot = Record<InputKey, boolean>;

type AnalogInput = {
  x: number;
  y: number;
};

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
  maxTargets: number;
  spawnPadding: number;
  safeSpawnPadding: number;
  targetSpeedRange: number;
  joystickRadius: number;
  joystickDeadzone: number;
};

type PhysicsCommand = {
  type: "apply-force" | "apply-impulse";
  bodyId: PhysicsBodyId;
  force: Vec2Value;
};

type GameplayCommand =
  | {
      type: "consume-target";
      playerId: EntityId;
      targetId: EntityId;
    }
  | {
      type: "game-over";
    };

type SpawnRequest = {
  type: "spawn-target";
  safeForPlayer: boolean;
  safeAppearance?: Appearance;
};

type CollisionEvent = {
  playerId: EntityId;
  targetId: EntityId;
};

type QueueState = {
  physics: PhysicsCommand[];
  gameplay: GameplayCommand[];
  spawns: SpawnRequest[];
  collisionEvents: CollisionEvent[];
};

type PlayerEntity = With<GameEntity, "player" | "transform" | "appearance" | "physics">;
type TargetEntity = With<GameEntity, "target" | "transform" | "appearance" | "physics">;
type PhysicsEntity = With<GameEntity, "transform" | "physics">;
type RenderableEntity = With<GameEntity, "transform" | "appearance" | "renderable">;
type AppearancePhysicsEntity = With<GameEntity, "appearance" | "physics">;
type InteractiveEntity = With<GameEntity, "transform" | "appearance" | "physics">;

type QuerySet = {
  players: Query<PlayerEntity>;
  targets: Query<TargetEntity>;
  physicsBodies: Query<PhysicsEntity>;
  renderables: Query<RenderableEntity>;
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

type PhysicsAdapter = {
  createWorld(bounds: Bounds): void;
  destroyWorld(): void;
  createDynamicBody(spec: DynamicBodySpec): PhysicsBodyId;
  destroyBody(bodyId: PhysicsBodyId): void;
  setShape(bodyId: PhysicsBodyId, shapeSpec: { shape: Shape; size: number }): void;
  applyForce(bodyId: PhysicsBodyId, force: Vec2Value): void;
  applyImpulse(bodyId: PhysicsBodyId, impulse: Vec2Value): void;
  step(dt: number): void;
  clampSpeed(bodyId: PhysicsBodyId, maxSpeed: number): void;
  readTransform(bodyId: PhysicsBodyId): Transform | null;
  resizeBounds(bounds: Bounds, dynamicBodies: PhysicsBodySnapshot[]): void;
  drainCollisionEvents(): Array<{ bodyIdA: PhysicsBodyId; bodyIdB: PhysicsBodyId }>;
};

type Runtime = {
  state: GameState;
  score: number;
  nextEntityId: number;
  accumulator: number;
  lastFrameTime: number;
  ecsWorld: ECSWorld<GameEntity>;
  queries: QuerySet;
  physicsAdapter: PhysicsAdapter | null;
  input: InputSnapshot;
  analogInput: AnalogInput;
  canvasMetrics: CanvasMetrics;
  gameplayProfile: GameplayProfile;
  queues: QueueState;
};

type JoystickState = {
  pointerId: number | null;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  moved: boolean;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const SCALE = 30;
const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 1 / 24;
const PLAYER_THRUST = 5.25;
const PLAYER_TAP_IMPULSE = 3.5;
const MIN_POINTER_TARGET_DISTANCE = 10;
const TOUCH_TAP_MOVE_THRESHOLD = 14;
const MAX_SPEED = 8;
const LINEAR_DAMPING = 0;
const ANGULAR_DAMPING = 0.15;
const ENTITY_SIZE = 0.55;
const WALL_THICKNESS = 0.35;
const MAX_SPAWN_ATTEMPTS = 80;
const COMPACT_TOUCH_BREAKPOINT = 820;
const SHAPES: Shape[] = ["circle", "square", "triangle"];
const COLORS: ColorName[] = ["red", "blue", "green"];
const FILL_STYLES: FillStyleName[] = ["filled", "outline", "dashed"];
const COLOR_MAP: Record<ColorName, string> = {
  red: "#ff5f5f",
  blue: "#66a8ff",
  green: "#59e093",
};
const DIRECTIONAL_KEYS = new Set<string>(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);
const PAUSE_KEY = "escape";
const RULES_STORAGE_KEY = "shapes-game.rulesAccepted";
const GAME_RULES = [
  "На телефоне удерживай джойстик, на компьютере кликай по области для толчка.",
  "Съедать можно только фигуры, которые отличаются по всем трем свойствам.",
  "Если совпадает хотя бы одно свойство, забег сразу заканчивается.",
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

const hudPlayerElement = document.getElementById("hud-player");
if (!(hudPlayerElement instanceof HTMLParagraphElement)) {
  throw new Error("HUD player element not found");
}
const hudPlayer = hudPlayerElement;

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

const joystickElement = document.getElementById("joystick");
if (!(joystickElement instanceof HTMLDivElement)) {
  throw new Error("Joystick element not found");
}
const joystick = joystickElement;

const joystickKnobElement = document.getElementById("joystick-knob");
if (!(joystickKnobElement instanceof HTMLDivElement)) {
  throw new Error("Joystick knob element not found");
}
const joystickKnob = joystickKnobElement;
const rootStyle = document.documentElement.style;

function detectTouchDevice(): boolean {
  return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches;
}

const isTouchDevice = detectTouchDevice();
const game = createRuntime();
let overlayMode: OverlayMode = null;
let shouldRetryFullscreen = true;
const joystickState: JoystickState = {
  pointerId: null,
  originX: 0,
  originY: 0,
  dx: 0,
  dy: 0,
  moved: false,
};

function createRuntime(): Runtime {
  const ecsWorld = new ECSWorld<GameEntity>();
  const canvasMetrics = createCanvasMetrics();

  return {
    state: "boot",
    score: 0,
    nextEntityId: 1,
    accumulator: 0,
    lastFrameTime: 0,
    ecsWorld,
    queries: createQueries(ecsWorld),
    physicsAdapter: null,
    input: createInputSnapshot(),
    analogInput: createAnalogInput(),
    canvasMetrics,
    gameplayProfile: createGameplayProfile(canvasMetrics),
    queues: createQueues(),
  };
}

function createQueries(ecsWorld: ECSWorld<GameEntity>): QuerySet {
  return {
    players: ecsWorld.with("player", "transform", "appearance", "physics"),
    targets: ecsWorld.with("target", "transform", "appearance", "physics"),
    physicsBodies: ecsWorld.with("transform", "physics"),
    renderables: ecsWorld.with("transform", "appearance", "renderable"),
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

function createAnalogInput(): AnalogInput {
  return {
    x: 0,
    y: 0,
  };
}

function createGameplayProfile(metrics: CanvasMetrics): GameplayProfile {
  const compactTouch = isTouchDevice && Math.min(metrics.widthCss || 0, metrics.heightCss || 0) < COMPACT_TOUCH_BREAKPOINT;

  if (compactTouch) {
    return {
      compactTouch,
      startTargetCount: 5,
      minTargetsAfterScore: 6,
      maxTargets: 12,
      spawnPadding: 2.25,
      safeSpawnPadding: 3.1,
      targetSpeedRange: 2.4,
      joystickRadius: 44,
      joystickDeadzone: 8,
    };
  }

  return {
    compactTouch,
    startTargetCount: 9,
    minTargetsAfterScore: 10,
    maxTargets: 20,
    spawnPadding: 1.8,
    safeSpawnPadding: 2.3,
    targetSpeedRange: 3.5,
    joystickRadius: 36,
    joystickDeadzone: 10,
  };
}

function getGameplayProfile(): GameplayProfile {
  return game.gameplayProfile;
}

function updateGameplayProfile(): void {
  game.gameplayProfile = createGameplayProfile(game.canvasMetrics);
}

function getShapeHudLabel(shape: Shape): string {
  if (shape === "circle") return "○";
  if (shape === "square") return "□";
  return "△";
}

function getFillHudLabel(fillStyle: FillStyleName, compact: boolean): string {
  if (!compact) return fillStyle;
  if (fillStyle === "filled") return "fill";
  if (fillStyle === "outline") return "line";
  return "dash";
}

function formatPlayerHud(appearance: Appearance, compact: boolean): string {
  if (!compact) {
    return `Игрок: ${appearance.shape} / ${appearance.color} / ${appearance.fillStyle}`;
  }

  return `Игрок: ${getShapeHudLabel(appearance.shape)} ${appearance.color} ${getFillHudLabel(appearance.fillStyle, true)}`;
}

function updateHud(): void {
  const player = getPlayerEntity();
  const compactHud = getGameplayProfile().compactTouch;
  hudScore.textContent = `Счет: ${game.score}`;
  hudPlayer.textContent = player
    ? formatPlayerHud(player.appearance, compactHud)
    : "Игрок: -";
  hudPlayer.dataset.compact = compactHud ? "true" : "false";
  pauseButton.textContent = game.state === "paused" ? "▶" : "II";
  pauseButton.setAttribute("aria-label", game.state === "paused" ? "Продолжить игру" : "Поставить игру на паузу");
}

function setDirectionalInput(inputKey: InputKey, isPressed: boolean): void {
  game.input[inputKey] = isPressed;
}

function setJoystickPosition(x: number, y: number): void {
  joystick.style.left = `${x}px`;
  joystick.style.top = `${y}px`;
}

function applyJoystickInput(dx: number, dy: number): void {
  joystickState.dx = dx;
  joystickState.dy = dy;
  game.analogInput.x = dx;
  game.analogInput.y = dy;
}

function resetJoystick(): void {
  joystickState.pointerId = null;
  joystickState.dx = 0;
  joystickState.dy = 0;
  joystickState.moved = false;
  game.analogInput.x = 0;
  game.analogInput.y = 0;
  joystick.classList.remove("visible");
  joystick.setAttribute("aria-hidden", "true");
  joystickKnob.style.transform = "translate(0px, 0px)";
}

function clearActiveTouchInputs(): void {
  resetJoystick();
}

function updateJoystick(pointerX: number, pointerY: number): void {
  const rawDx = pointerX - joystickState.originX;
  const rawDy = pointerY - joystickState.originY;
  const distance = Math.hypot(rawDx, rawDy);
  if (distance >= TOUCH_TAP_MOVE_THRESHOLD) {
    joystickState.moved = true;
  }
  const joystickRadius = getGameplayProfile().joystickRadius;
  const limitedDistance = Math.min(distance, joystickRadius);
  const ratio = distance === 0 ? 0 : limitedDistance / distance;
  const dx = rawDx * ratio;
  const dy = rawDy * ratio;
  const normalizedX = joystickRadius === 0 ? 0 : dx / joystickRadius;
  const normalizedY = joystickRadius === 0 ? 0 : dy / joystickRadius;
  const deadzoneRatio = joystickRadius === 0 ? 0 : getGameplayProfile().joystickDeadzone / joystickRadius;
  const magnitude = Math.hypot(normalizedX, normalizedY);

  if (magnitude <= deadzoneRatio) {
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    applyJoystickInput(0, 0);
    return;
  }

  const easedMagnitude = clamp((magnitude - deadzoneRatio) / (1 - deadzoneRatio), 0, 1);
  const directionX = magnitude === 0 ? 0 : normalizedX / magnitude;
  const directionY = magnitude === 0 ? 0 : normalizedY / magnitude;

  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  applyJoystickInput(directionX * easedMagnitude, directionY * easedMagnitude);
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

function applyPointerImpulse(pointerX: number, pointerY: number): void {
  if (game.state !== "playing") return;

  const player = getPlayerEntity();
  if (!player) return;

  const playerCanvasPosition = worldToCanvas(player.transform.x, player.transform.y);
  const deltaX = pointerX - playerCanvasPosition.x;
  const deltaY = pointerY - playerCanvasPosition.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < MIN_POINTER_TARGET_DISTANCE) return;

  const normalizedX = deltaX / distance;
  const normalizedY = -deltaY / distance;
  game.queues.physics.push({
    type: "apply-impulse",
    bodyId: player.physics.bodyId,
    force: {
      x: normalizedX * PLAYER_TAP_IMPULSE,
      y: normalizedY * PLAYER_TAP_IMPULSE,
    },
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

  function getDesiredTargetCount(score: number): number {
    const profile = getGameplayProfile();

    if (score === 0) {
      return profile.startTargetCount;
    }

    return Math.min(profile.minTargetsAfterScore + Math.floor(score / 3), profile.maxTargets);
  }

function clearInputState(): void {
  setDirectionalInput("up", false);
  setDirectionalInput("down", false);
  setDirectionalInput("left", false);
  setDirectionalInput("right", false);
  game.analogInput.x = 0;
  game.analogInput.y = 0;
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

function showOnboardingOverlay(): void {
  overlayMode = "onboarding";
  overlayTitle.textContent = "Правила";
  overlayMessage.textContent = "";
  setOverlayTips(GAME_RULES);
  overlayPrimaryButton.textContent = "Понятно";
  overlaySecondaryButton.hidden = true;
  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
}

function showPauseOverlay(autoPaused: boolean): void {
  overlayMode = "pause";
  overlayTitle.textContent = "Пауза";
  overlayMessage.textContent = autoPaused ? "Игра остановлена." : "";
  setOverlayTips(GAME_RULES);
  overlayPrimaryButton.textContent = "Продолжить";
  overlaySecondaryButton.textContent = "Начать заново";
  overlaySecondaryButton.hidden = false;
  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
}

function showGameOverOverlay(): void {
  overlayMode = "gameOver";
  overlayTitle.textContent = "Игра окончена";
  overlayMessage.textContent = `Счет: ${game.score}`;
  setOverlayTips([]);
  overlayPrimaryButton.textContent = "Начать заново";
  overlaySecondaryButton.hidden = true;
  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
}

function hideOverlay(): void {
  overlayMode = null;
  setOverlayTips([]);
  overlay.classList.remove("visible");
  overlay.setAttribute("aria-hidden", "true");
}

function pauseGame(autoPaused = false): void {
  if (game.state !== "playing") return;

  game.state = "paused";
  game.accumulator = 0;
  game.lastFrameTime = performance.now();
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

      applyForce(bodyId, force) {
        const body = bodies.get(bodyId);
        if (!body) return;
        body.applyForceToCenter(Vec2(force.x, force.y), true);
      },

      applyImpulse(bodyId, impulse) {
        const body = bodies.get(bodyId);
        if (!body) return;
        body.applyLinearImpulse(Vec2(impulse.x, impulse.y), body.getWorldCenter(), true);
      },

      step(dt) {
        world?.step(dt);
      },

      clampSpeed(bodyId, maxSpeed) {
        const body = bodies.get(bodyId);
        if (!body) return;

        const velocity = body.getLinearVelocity();
        const speed = velocity.length();
        if (speed <= maxSpeed) return;

        body.setLinearVelocity(Vec2((velocity.x / speed) * maxSpeed, (velocity.y / speed) * maxSpeed));
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

  function createECSRuntime(): void {
    game.ecsWorld = new ECSWorld<GameEntity>();
    game.queries = createQueries(game.ecsWorld);
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

  function getEntityById(entityId: EntityId): InteractiveEntity | null {
    for (const entity of game.ecsWorld.with("transform", "appearance", "physics")) {
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
    isPlayer?: boolean;
    appearance?: Appearance | null;
    safeForAppearance?: Appearance | null;
    spawnPadding?: number;
    speedRange?: number;
  }): GameEntity {
    const isPlayer = options.isPlayer ?? false;
    const profile = getGameplayProfile();
    const spawnPadding = options.spawnPadding ?? profile.spawnPadding;
    const speedRange = options.speedRange ?? profile.targetSpeedRange;
    const nextAppearance: Appearance = options.appearance ?? {
      ...createEntityProperties(options.safeForAppearance ?? null),
      size: ENTITY_SIZE,
    };

    const entity: InteractiveEntity & ({ player: true } | { target: true }) = {
      id: game.nextEntityId++,
      transform: { x: 0, y: 0, angle: 0 },
      appearance: nextAppearance,
      physics: {
        bodyId: -1,
        radius: getShapeRadius(nextAppearance.shape, nextAppearance.size),
      },
      renderable: true,
      ...(isPlayer ? { player: true } : { target: true }),
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
        x: isPlayer ? 0 : randomRange(-speedRange, speedRange),
        y: isPlayer ? 0 : randomRange(-speedRange, speedRange),
      },
      angularVelocity: randomRange(-1.4, 1.4),
    });

    entity.physics.bodyId = bodyId;
    entity.transform.x = spawn.x;
    entity.transform.y = spawn.y;
    game.ecsWorld.add(entity);
    adapter.clampSpeed(bodyId, MAX_SPEED);
    return entity;
  }

  function destroyFigureEntity(entity: AppearancePhysicsEntity): void {
    game.physicsAdapter?.destroyBody(entity.physics.bodyId);
    game.ecsWorld.remove(entity);
  }

  function InputIntentSystem(): void {
    if (game.state !== "playing") return;

    const player = getPlayerEntity();
    if (!player) return;

    let forceX = 0;
    let forceY = 0;

    if (joystickState.pointerId !== null) {
      forceX = game.analogInput.x * PLAYER_THRUST;
      forceY = -game.analogInput.y * PLAYER_THRUST;
    } else {
      if (game.input.up) forceY += PLAYER_THRUST;
      if (game.input.down) forceY -= PLAYER_THRUST;
      if (game.input.left) forceX -= PLAYER_THRUST;
      if (game.input.right) forceX += PLAYER_THRUST;
    }

    if (forceX === 0 && forceY === 0) return;

    game.queues.physics.push({
      type: "apply-force",
      bodyId: player.physics.bodyId,
      force: { x: forceX, y: forceY },
    });
  }

  function PhysicsCommandSystem(): void {
    while (game.queues.physics.length > 0) {
      const command = game.queues.physics.shift();
      if (!command) continue;

      if (command.type === "apply-force") {
        game.physicsAdapter?.applyForce(command.bodyId, command.force);
        continue;
      }

      if (command.type === "apply-impulse") {
        game.physicsAdapter?.applyImpulse(command.bodyId, command.force);
      }
    }
  }

  function PhysicsStepSystem(): void {
    if (game.state !== "playing") return;
    game.physicsAdapter?.step(FIXED_DT);
  }

  function MotionConstraintSystem(): void {
    for (const entity of game.queries.physicsBodies) {
      game.physicsAdapter?.clampSpeed(entity.physics.bodyId, MAX_SPEED);
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
      const targetEntity = entityA.target ? entityA : entityB.target ? entityB : null;
      if (!playerEntity || !targetEntity) continue;

      const pairKey = `${playerEntity.id}:${targetEntity.id}`;
      if (uniquePairs.has(pairKey)) continue;

      uniquePairs.add(pairKey);
      game.queues.collisionEvents.push({
        playerId: playerEntity.id,
        targetId: targetEntity.id,
      });
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

      game.queues.gameplay.push({ type: "game-over" });
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
      }

      if (command.type === "game-over") {
        game.state = "gameOver";
        clearInputState();
        clearActiveTouchInputs();
        game.queues.physics.length = 0;
        game.queues.collisionEvents.length = 0;
        game.accumulator = 0;
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
      if (!request || request.type !== "spawn-target") continue;

      createFigureEntity({
        isPlayer: false,
        safeForAppearance: request.safeForPlayer ? request.safeAppearance ?? null : null,
        spawnPadding: request.safeForPlayer ? getGameplayProfile().safeSpawnPadding : getGameplayProfile().spawnPadding,
      });
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

  function drawRoomBorder(): void {
    const metrics = getCanvasMetrics();
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, metrics.widthCss - 2, metrics.heightCss - 2);
    ctx.restore();
  }

  function drawPlayerMarker(radiusPx: number): void {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -radiusPx - 9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawEntity(entity: RenderableEntity): void {
    const { x, y } = worldToCanvas(entity.transform.x, entity.transform.y);
    const color = COLOR_MAP[entity.appearance.color];

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-entity.transform.angle);
    ctx.lineWidth = entity.player ? 4.5 : 2.2;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.setLineDash(entity.appearance.fillStyle === "dashed" ? [9, 6] : []);

    traceShape(entity.appearance.shape, entity.appearance.size);

    if (entity.appearance.fillStyle === "filled") {
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    } else {
      ctx.stroke();
    }

    ctx.setLineDash([]);

    if (entity.player) {
      drawPlayerMarker(entity.appearance.size * SCALE);
    }

    ctx.restore();
  }

  function RenderSystem(): void {
    const metrics = getCanvasMetrics();
    ctx.clearRect(0, 0, metrics.widthCss, metrics.heightCss);
    drawRoomBorder();

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
    createECSRuntime();
    game.score = 0;
    game.nextEntityId = 1;
    game.accumulator = 0;
    game.lastFrameTime = performance.now();
    game.state = "playing";
    game.queues = createQueues();
    clearInputState();
    clearActiveTouchInputs();
    hideOverlay();
    updateHud();
  }

  function seedWorld(): void {
    createFigureEntity({ isPlayer: true });
    const profile = getGameplayProfile();
    const startPadding = profile.compactTouch ? profile.safeSpawnPadding : profile.spawnPadding;

    for (let index = 0; index < profile.startTargetCount; index += 1) {
      createFigureEntity({
        isPlayer: false,
        spawnPadding: startPadding,
      });
    }
  }

  function restartGame(): void {
    resetRuntime();
    seedWorld();
  }

  const FIXED_TICK_SYSTEMS: Array<() => void> = [
    InputIntentSystem,
    PhysicsCommandSystem,
    PhysicsStepSystem,
    MotionConstraintSystem,
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

  function setInputKey(key: string, isPressed: boolean): void {
    if (key === "arrowup" || key === "w") setDirectionalInput("up", isPressed);
    if (key === "arrowdown" || key === "s") setDirectionalInput("down", isPressed);
    if (key === "arrowleft" || key === "a") setDirectionalInput("left", isPressed);
    if (key === "arrowright" || key === "d") setDirectionalInput("right", isPressed);
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === PAUSE_KEY) {
      event.preventDefault();
      togglePauseGame();
      return;
    }

    if (!DIRECTIONAL_KEYS.has(key) || game.state !== "playing") return;
    event.preventDefault();
    setInputKey(key, true);
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (!DIRECTIONAL_KEYS.has(key)) return;
    event.preventDefault();
    setInputKey(key, false);
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
    restartGame();
  });

  function releaseTouchPointer(pointerId: number): void {
    if (joystickState.pointerId !== pointerId) return;
    resetJoystick();
  }

  canvas.addEventListener("pointerdown", (event) => {
    retryFullscreenOnUserGesture();
    if (game.state !== "playing") return;

    if (event.pointerType === "touch") {
      if (joystickState.pointerId !== null) return;

      event.preventDefault();
      joystickState.pointerId = event.pointerId;
      joystickState.originX = event.clientX;
      joystickState.originY = event.clientY;
      joystickState.moved = false;
      setJoystickPosition(event.clientX, event.clientY);
      joystick.classList.add("visible");
      joystick.setAttribute("aria-hidden", "false");
      updateJoystick(event.clientX, event.clientY);
      canvas.setPointerCapture(event.pointerId);
      return;
    }

    applyPointerImpulse(event.clientX, event.clientY);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== joystickState.pointerId) return;
    event.preventDefault();
    updateJoystick(event.clientX, event.clientY);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerId !== joystickState.pointerId) return;
    event.preventDefault();
    if (!joystickState.moved) {
      applyPointerImpulse(event.clientX, event.clientY);
    }
    releaseTouchPointer(event.pointerId);
  });

  canvas.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== joystickState.pointerId) return;
    event.preventDefault();
    releaseTouchPointer(event.pointerId);
  });

  canvas.addEventListener("lostpointercapture", (event) => {
    releaseTouchPointer(event.pointerId);
  });

  installBrowserInteractionGuards();
  installDoubleTapZoomGuard(modal);
  resizeCanvas();
  scheduleInitialFullscreenAttempt();
  resetRuntime();
  seedWorld();
  if (!areRulesAccepted()) {
    startOnboarding();
  }
  requestAnimationFrame(frame);
