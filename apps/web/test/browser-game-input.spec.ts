import { beforeEach, describe, expect, test } from "vitest";
import {
  createBrowserGameInput,
  type BrowserGameInputEvent,
} from "../src/game/browser-game-input.ts";

let canvas: HTMLCanvasElement;
let modal: HTMLDivElement;
let visualViewport: EventTarget;
let nowMs: number;
let events: BrowserGameInputEvent[];

function installInput(options: { touchJoystick?: boolean } = {}): void {
  const capturedEvents = events;
  const input = createBrowserGameInput({
    canvas,
    modal,
    window,
    document,
    visualViewport,
    now: () => nowMs,
    isTouchJoystickEnabled: () => options.touchJoystick ?? false,
  });
  input.subscribe((event) => capturedEvents.push(event));
  input.install();
}

function dispatchKeyboardEvent(type: "keydown" | "keyup", key: string): KeyboardEvent {
  const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

function dispatchPointerDown(init: Partial<PointerEventInit> = {}): PointerEvent {
  const event = new PointerEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    clientX: 100,
    clientY: 120,
    button: 0,
    pointerType: "mouse",
    ...init,
  });
  canvas.dispatchEvent(event);
  return event;
}

function dispatchPointerEvent(type: "pointermove" | "pointerup" | "pointercancel", init: Partial<PointerEventInit> = {}): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: 100,
    clientY: 120,
    button: 0,
    pointerId: 1,
    pointerType: "touch",
    ...init,
  });
  canvas.dispatchEvent(event);
  return event;
}

function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
}

function dispatchTouchMove(target: Element): Event {
  const event = new Event("touchmove", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: [{ clientX: 100, clientY: 120 }],
  });
  target.dispatchEvent(event);
  return event;
}

function dispatchTouchEnd(target: Element, timeStamp: number, clientX = 100, clientY = 120): Event {
  const event = new Event("touchend", { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    changedTouches: {
      value: [{ clientX, clientY }],
    },
    timeStamp: {
      value: timeStamp,
    },
  });
  target.dispatchEvent(event);
  return event;
}

function dispatchTouchStart(target: Element, timeStamp: number, clientX = 100, clientY = 120): Event {
  const event = new Event("touchstart", { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: {
      value: [{ clientX, clientY }],
    },
    timeStamp: {
      value: timeStamp,
    },
  });
  target.dispatchEvent(event);
  return event;
}

describe("browser game input", () => {
  beforeEach(() => {
    document.body.innerHTML = `<canvas id="game"></canvas><div class="modal"></div>`;
    const canvasElement = document.getElementById("game");
    const modalElement = document.querySelector(".modal");

    if (!(canvasElement instanceof HTMLCanvasElement) || !(modalElement instanceof HTMLDivElement)) {
      throw new Error("Failed to create browser game input test DOM");
    }

    canvas = canvasElement;
    modal = modalElement;
    visualViewport = new EventTarget();
    nowMs = 1_000;
    events = [];
  });

  test("maps keyboard events to pause and direction input events", () => {
    installInput();

    const pause = dispatchKeyboardEvent("keydown", "Escape");
    const up = dispatchKeyboardEvent("keydown", "ArrowUp");
    const right = dispatchKeyboardEvent("keydown", "d");
    const upRelease = dispatchKeyboardEvent("keyup", "w");
    const unrelated = dispatchKeyboardEvent("keydown", "Enter");

    expect(pause.defaultPrevented).toBe(true);
    expect(up.defaultPrevented).toBe(true);
    expect(right.defaultPrevented).toBe(true);
    expect(upRelease.defaultPrevented).toBe(true);
    expect(unrelated.defaultPrevented).toBe(false);
    expect(events).toEqual([
      { type: "pause-toggle-requested" },
      { type: "direction-key-changed", key: "up", pressed: true },
      { type: "direction-key-changed", key: "right", pressed: true },
      { type: "direction-key-changed", key: "up", pressed: false },
    ]);
  });

  test("maps valid pointer events to user gesture and pointer aim events", () => {
    installInput();

    const event = dispatchPointerDown({ clientX: 320, clientY: 180, pointerType: "touch" });

    expect(event.defaultPrevented).toBe(true);
    expect(events).toEqual([
      { type: "user-gesture" },
      {
        type: "pointer-aim-requested",
        canvasX: 320,
        canvasY: 180,
        pointerType: "touch",
      },
    ]);
  });

  test("ignores non-left mouse pointer events", () => {
    installInput();

    const event = dispatchPointerDown({ button: 2 });

    expect(event.defaultPrevented).toBe(false);
    expect(events).toEqual([]);
  });

  test("allows scrolling from non-interactive content inside scrollable panels", () => {
    modal.innerHTML = `<p>Scrollable modal copy</p>`;
    const settingsForm = document.createElement("div");
    settingsForm.className = "settings-form";
    settingsForm.innerHTML = `<label>Scrollable settings copy</label>`;
    const leaderboardList = document.createElement("div");
    leaderboardList.className = "leaderboard-list";
    leaderboardList.innerHTML = `<span>Scrollable leaderboard copy</span>`;
    const gameSurface = document.createElement("div");
    document.body.append(settingsForm, leaderboardList, gameSurface);
    installInput();

    expect(dispatchTouchMove(modal.querySelector("p") as HTMLParagraphElement).defaultPrevented).toBe(false);
    expect(dispatchTouchMove(settingsForm.querySelector("label") as HTMLLabelElement).defaultPrevented).toBe(false);
    expect(dispatchTouchMove(leaderboardList.querySelector("span") as HTMLSpanElement).defaultPrevented).toBe(false);
    expect(dispatchTouchMove(gameSurface).defaultPrevented).toBe(true);
  });

  test("prevents double-tap zoom before the second tap starts outside the modal", () => {
    const htmlSurface = document.createElement("div");
    document.body.append(htmlSurface);
    installInput();

    const firstTapStart = dispatchTouchStart(htmlSurface, 1_000);
    const firstTapEnd = dispatchTouchEnd(htmlSurface, 1_050);
    const secondTapStart = dispatchTouchStart(htmlSurface, 1_200, 108, 126);

    expect(firstTapStart.defaultPrevented).toBe(false);
    expect(firstTapEnd.defaultPrevented).toBe(false);
    expect(secondTapStart.defaultPrevented).toBe(true);
  });

  test("prevents the synthetic double-click used for browser smart zoom", () => {
    const modalContent = document.createElement("p");
    modal.append(modalContent);
    installInput();

    const doubleClick = new MouseEvent("dblclick", { bubbles: true, cancelable: true });
    modalContent.dispatchEvent(doubleClick);

    expect(doubleClick.defaultPrevented).toBe(true);
  });

  test("emits boost request for rapid nearby second pointer event", () => {
    installInput();

    dispatchPointerDown({ clientX: 200, clientY: 220 });
    nowMs += 120;
    dispatchPointerDown({ clientX: 215, clientY: 235 });

    expect(events).toEqual([
      { type: "user-gesture" },
      {
        type: "pointer-aim-requested",
        canvasX: 200,
        canvasY: 220,
        pointerType: "mouse",
      },
      { type: "user-gesture" },
      { type: "player-boost-requested" },
      {
        type: "pointer-aim-requested",
        canvasX: 215,
        canvasY: 235,
        pointerType: "mouse",
      },
    ]);
  });

  test("maps mobile joystick drag to a normalized direction until pointerup", () => {
    installInput({ touchJoystick: true });

    dispatchPointerDown({ clientX: 200, clientY: 220, pointerId: 7, pointerType: "touch" });
    dispatchPointerEvent("pointermove", { clientX: 204, clientY: 223, pointerId: 7 });
    const drag = dispatchPointerEvent("pointermove", { clientX: 230, clientY: 260, pointerId: 7 });
    dispatchPointerEvent("pointerup", { clientX: 230, clientY: 260, pointerId: 7 });
    dispatchPointerEvent("pointermove", { clientX: 260, clientY: 220, pointerId: 7 });

    expect(drag.defaultPrevented).toBe(true);
    expect(events).toEqual([
      { type: "user-gesture" },
      {
        type: "pointer-aim-requested",
        canvasX: 200,
        canvasY: 220,
        pointerType: "touch",
      },
      {
        type: "direction-vector-requested",
        direction: { x: 0.6, y: -0.8 },
      },
    ]);
  });

  test("keeps desktop pointer movement out of joystick steering", () => {
    installInput();

    dispatchPointerDown({ clientX: 200, clientY: 220, pointerId: 4 });
    dispatchPointerEvent("pointermove", { clientX: 260, clientY: 220, pointerId: 4 });

    expect(events).toEqual([
      { type: "user-gesture" },
      {
        type: "pointer-aim-requested",
        canvasX: 200,
        canvasY: 220,
        pointerType: "mouse",
      },
    ]);
  });

  test("maps browser lifecycle events to auto pause events", () => {
    installInput();

    window.dispatchEvent(new Event("blur"));
    setDocumentHidden(false);
    document.dispatchEvent(new Event("visibilitychange"));
    setDocumentHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));

    expect(events).toEqual([
      { type: "auto-pause-requested" },
      { type: "auto-pause-requested" },
    ]);
  });

  test("maps viewport and fullscreen changes", () => {
    installInput();

    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("orientationchange"));
    visualViewport.dispatchEvent(new Event("resize"));
    visualViewport.dispatchEvent(new Event("scroll"));
    document.dispatchEvent(new Event("fullscreenchange"));
    document.dispatchEvent(new Event("webkitfullscreenchange"));

    expect(events).toEqual([
      { type: "viewport-change-requested" },
      { type: "viewport-change-requested" },
      { type: "viewport-change-requested" },
      { type: "viewport-change-requested" },
      { type: "fullscreen-change-requested" },
      { type: "fullscreen-change-requested" },
    ]);
  });
});
