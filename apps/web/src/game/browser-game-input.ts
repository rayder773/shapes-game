import type { InputKey } from "./game-runtime.ts";

export type BrowserGameInputEvent =
  | { type: "pause-toggle-requested" }
  | { type: "direction-key-changed"; key: InputKey; pressed: boolean }
  | { type: "pointer-aim-requested"; canvasX: number; canvasY: number; pointerType: string }
  | { type: "direction-vector-requested"; direction: { x: number; y: number } }
  | { type: "player-boost-requested" }
  | { type: "auto-pause-requested" }
  | { type: "viewport-change-requested" }
  | { type: "fullscreen-change-requested" }
  | { type: "user-gesture" };

export type BrowserGameInputListener = (event: BrowserGameInputEvent) => void;

export type BrowserGameInput = {
  install(): void;
  subscribe(listener: BrowserGameInputListener): () => void;
};

export type BrowserGameInputDependencies = {
  canvas: HTMLCanvasElement;
  modal: HTMLElement;
  window: Window;
  document: Document;
  visualViewport?: EventTarget | null;
  now: () => number;
  isGameRouteActive?: () => boolean;
  isGamePlaying?: () => boolean;
  isTouchJoystickEnabled?: () => boolean;
};

const DIRECTIONAL_KEYS = new Map<string, InputKey>([
  ["arrowup", "up"],
  ["w", "up"],
  ["arrowdown", "down"],
  ["s", "down"],
  ["arrowleft", "left"],
  ["a", "left"],
  ["arrowright", "right"],
  ["d", "right"],
]);
const PAUSE_KEY = "escape";
const DOUBLE_TAP_WINDOW_MS = 300;
const DOUBLE_TAP_RADIUS_PX = 40;
const DOUBLE_TAP_ZOOM_WINDOW_MS = 350;
const DOUBLE_TAP_ZOOM_RADIUS_PX = 24;
const JOYSTICK_DEAD_ZONE_PX = 8;

function allowsDocumentTouchMove(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  return Boolean(target.closest(
    "button, a, input, select, textarea, summary, [role=\"button\"], .modal, .settings-form, .leaderboard-list",
  ));
}

export function createBrowserGameInput({
  canvas,
  window,
  document,
  visualViewport,
  now,
  isGameRouteActive = () => true,
  isGamePlaying = () => true,
  isTouchJoystickEnabled = () => false,
}: BrowserGameInputDependencies): BrowserGameInput {
  const listeners = new Set<BrowserGameInputListener>();
  let hasInstalled = false;
  let lastPointerDownTime = 0;
  let lastPointerDownX = 0;
  let lastPointerDownY = 0;
  let activeJoystickPointerId: number | null = null;
  let joystickStartX = 0;
  let joystickStartY = 0;

  function emit(event: BrowserGameInputEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
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
      if (event.touches.length > 1 || !allowsDocumentTouchMove(event.target)) {
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

  function installDoubleTapZoomGuard(): void {
    const captureOptions: AddEventListenerOptions = { capture: true, passive: false };
    let lastTouchEndTime = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;

    document.addEventListener("touchstart", (event) => {
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      const elapsed = event.timeStamp - lastTouchEndTime;
      const isRapidSecondTap = elapsed > 0 && elapsed < DOUBLE_TAP_ZOOM_WINDOW_MS;
      const isNearbyTap =
        Math.abs(touch.clientX - lastTouchX) < DOUBLE_TAP_ZOOM_RADIUS_PX &&
        Math.abs(touch.clientY - lastTouchY) < DOUBLE_TAP_ZOOM_RADIUS_PX;

      if (isRapidSecondTap && isNearbyTap) {
        event.preventDefault();
      }
    }, captureOptions);

    document.addEventListener("touchend", (event) => {
      if (event.changedTouches.length !== 1) return;

      const touch = event.changedTouches[0];
      const elapsed = event.timeStamp - lastTouchEndTime;
      const isRapidSecondTap = elapsed > 0 && elapsed < DOUBLE_TAP_ZOOM_WINDOW_MS;
      const isNearbyTap =
        Math.abs(touch.clientX - lastTouchX) < DOUBLE_TAP_ZOOM_RADIUS_PX &&
        Math.abs(touch.clientY - lastTouchY) < DOUBLE_TAP_ZOOM_RADIUS_PX;

      lastTouchEndTime = event.timeStamp;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;

      if (isRapidSecondTap && isNearbyTap) {
        event.preventDefault();
      }
    }, captureOptions);

    document.addEventListener("dblclick", (event) => {
      event.preventDefault();
    }, captureOptions);
  }

  function handleDirectionalKeyEvent(event: KeyboardEvent, pressed: boolean): void {
    const inputKey = DIRECTIONAL_KEYS.get(event.key.toLowerCase());
    if (!inputKey || !isGameRouteActive() || !isGamePlaying()) return;

    event.preventDefault();
    emit({ type: "direction-key-changed", key: inputKey, pressed });
  }

  function install(): void {
    if (hasInstalled) return;
    hasInstalled = true;

    window.addEventListener("keydown", (event) => {
      if (!isGameRouteActive()) return;

      const key = event.key.toLowerCase();
      if (key === PAUSE_KEY) {
        event.preventDefault();
        emit({ type: "pause-toggle-requested" });
        return;
      }

      handleDirectionalKeyEvent(event, true);
    });

    window.addEventListener("keyup", (event) => {
      handleDirectionalKeyEvent(event, false);
    });

    window.addEventListener("blur", () => {
      activeJoystickPointerId = null;
      emit({ type: "auto-pause-requested" });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        emit({ type: "auto-pause-requested" });
      }
    });

    window.addEventListener("resize", () => {
      emit({ type: "viewport-change-requested" });
    });
    window.addEventListener("orientationchange", () => {
      emit({ type: "viewport-change-requested" });
    });
    visualViewport?.addEventListener("resize", () => {
      emit({ type: "viewport-change-requested" });
    });
    visualViewport?.addEventListener("scroll", () => {
      emit({ type: "viewport-change-requested" });
    });
    document.addEventListener("fullscreenchange", () => {
      emit({ type: "fullscreen-change-requested" });
    });
    document.addEventListener("webkitfullscreenchange", () => {
      emit({ type: "fullscreen-change-requested" });
    });

    canvas.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      emit({ type: "user-gesture" });
      if (!isGameRouteActive() || !isGamePlaying()) return;

      event.preventDefault();

      if (
        isTouchJoystickEnabled()
        && activeJoystickPointerId !== null
        && activeJoystickPointerId !== event.pointerId
      ) return;

      const eventTime = now();
      const elapsed = eventTime - lastPointerDownTime;
      const isDoubleTap =
        elapsed > 0 &&
        elapsed < DOUBLE_TAP_WINDOW_MS &&
        Math.abs(event.clientX - lastPointerDownX) < DOUBLE_TAP_RADIUS_PX &&
        Math.abs(event.clientY - lastPointerDownY) < DOUBLE_TAP_RADIUS_PX;
      lastPointerDownTime = eventTime;
      lastPointerDownX = event.clientX;
      lastPointerDownY = event.clientY;

      if (isDoubleTap) {
        emit({ type: "player-boost-requested" });
      }

      const canvasBounds = canvas.getBoundingClientRect();

      emit({
        type: "pointer-aim-requested",
        canvasX: event.clientX - canvasBounds.left,
        canvasY: event.clientY - canvasBounds.top,
        pointerType: event.pointerType,
      });

      if (isTouchJoystickEnabled()) {
        activeJoystickPointerId = event.pointerId;
        joystickStartX = event.clientX;
        joystickStartY = event.clientY;
        canvas.setPointerCapture?.(event.pointerId);
      }
    });

    canvas.addEventListener("pointermove", (event) => {
      if (
        activeJoystickPointerId === null
        || event.pointerId !== activeJoystickPointerId
        || !isGameRouteActive()
        || !isGamePlaying()
      ) return;

      const deltaX = event.clientX - joystickStartX;
      const deltaY = event.clientY - joystickStartY;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance < JOYSTICK_DEAD_ZONE_PX) return;

      event.preventDefault();
      emit({
        type: "direction-vector-requested",
        direction: {
          x: deltaX / distance,
          y: -deltaY / distance,
        },
      });
    });

    const finishJoystickPointer = (event: PointerEvent): void => {
      if (event.pointerId !== activeJoystickPointerId) return;
      activeJoystickPointerId = null;
      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };
    canvas.addEventListener("pointerup", finishJoystickPointer);
    canvas.addEventListener("pointercancel", finishJoystickPointer);

    installBrowserInteractionGuards();
    installDoubleTapZoomGuard();
  }

  return {
    install,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
