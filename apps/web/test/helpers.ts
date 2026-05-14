import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, vi } from "vitest";

type Internals = {
  getCanvasLog: () => Array<{ method: string; args: unknown[] }>;
  resetCanvasLog: () => void;
  setViewport: (width: number, height: number) => void;
  setDeviceMode: (mode: "desktop" | "phone") => void;
  setStandaloneMode: (value: boolean) => void;
  dispatchViewportEvent: (type: string) => void;
  advanceNow: (ms: number) => void;
};

declare global {
  var __ANTI_MATCH_TEST_INTERNALS__: Internals;
}

const indexHtml = readFileSync(join(process.cwd(), "index.html"), "utf8");
const bodyMarkupMatch = indexHtml.match(/<body>([\s\S]*)<\/body>/);

if (!bodyMarkupMatch?.[1]) {
  throw new Error("Failed to extract index.html body markup for tests");
}

const bodyMarkup = bodyMarkupMatch[1].trim();

export function setDesktopDevice() {
  globalThis.__ANTI_MATCH_TEST_INTERNALS__.setDeviceMode("desktop");
}

export function setPhoneDevice() {
  globalThis.__ANTI_MATCH_TEST_INTERNALS__.setDeviceMode("phone");
}

export function setViewport(width: number, height: number) {
  globalThis.__ANTI_MATCH_TEST_INTERNALS__.setViewport(width, height);
}

export function setStandaloneMode(value: boolean) {
  globalThis.__ANTI_MATCH_TEST_INTERNALS__.setStandaloneMode(value);
}

export async function bootApp(path = "/shapes-game/") {
  vi.resetModules();
  document.body.innerHTML = bodyMarkup;
  window.history.replaceState({}, "", path);
  await import("../src/main.ts");
  await advanceFrames(4);
  return window.__ANTI_MATCH_TEST__;
}

export function snapshot() {
  return model();
}

export function model() {
  const api = window.__ANTI_MATCH_TEST__;
  expect(api).toBeDefined();
  return api!.model();
}

export function gameModel() {
  return model();
}

export function sceneEntities() {
  return gameModel().scene.entities;
}

export function playerModel() {
  const player = window.__ANTI_MATCH_TEST__?.getPlayer();
  expect(player).not.toBeNull();
  expect(player).toBeDefined();
  return player!;
}

export function targetModels() {
  const api = window.__ANTI_MATCH_TEST__;
  expect(api).toBeDefined();
  return api!.getTargets();
}

export function settingsModel() {
  const api = window.__ANTI_MATCH_TEST__;
  expect(api).toBeDefined();
  return api!.getSettingsState();
}

export function getCanvasLog() {
  return [...globalThis.__ANTI_MATCH_TEST_INTERNALS__.getCanvasLog()];
}

export function resetCanvasLog() {
  globalThis.__ANTI_MATCH_TEST_INTERNALS__.resetCanvasLog();
}

export async function advanceFrames(count: number, stepMs = 16) {
  for (let index = 0; index < count; index += 1) {
    globalThis.__ANTI_MATCH_TEST_INTERNALS__.advanceNow(stepMs);
    await Promise.resolve();
  }
}

export async function advanceUntil(
  predicate: () => boolean,
  options: { maxFrames?: number; stepMs?: number } = {},
) {
  const maxFrames = options.maxFrames ?? 240;
  const stepMs = options.stepMs ?? 16;

  for (let index = 0; index < maxFrames; index += 1) {
    if (predicate()) {
      return;
    }

    await advanceFrames(1, stepMs);
  }

  expect(predicate()).toBe(true);
}

export function click(element: Element) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

export function keydown(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

export function keyup(key: string) {
  window.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
}

export function blurWindow() {
  window.dispatchEvent(new Event("blur"));
}

export function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

export function resizeViewport(width: number, height: number) {
  setViewport(width, height);
  window.dispatchEvent(new Event("resize"));
}

export function orientationChange(width: number, height: number) {
  setViewport(width, height);
  window.dispatchEvent(new Event("orientationchange"));
}

export function visualViewportResize(width: number, height: number) {
  setViewport(width, height);
  globalThis.__ANTI_MATCH_TEST_INTERNALS__.dispatchViewportEvent("resize");
}

export function dispatchBeforeInstallPrompt() {
  const event = new Event("beforeinstallprompt", { bubbles: true, cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    preventDefault: () => void;
  };

  event.prompt = vi.fn(async () => {});
  event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" });
  event.preventDefault = vi.fn();
  window.dispatchEvent(event);
  return event;
}

export function pointerDownCanvasWorld(x: number, y: number, init: Partial<PointerEventInit> = {}) {
  const canvas = getCanvas();
  const clientX = x * 30;
  const clientY = window.innerHeight - y * 30;
  const event = new PointerEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    button: 0,
    pointerType: "mouse",
    ...init,
  });
  canvas.dispatchEvent(event);
}

export function getCanvas() {
  const canvas = document.getElementById("game");
  expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  return canvas as HTMLCanvasElement;
}

export function getPauseButton() {
  const button = document.getElementById("pause-button");
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

export function getOverlay() {
  const overlay = document.getElementById("overlay");
  expect(overlay).toBeInstanceOf(HTMLDivElement);
  return overlay as HTMLDivElement;
}

export function getSettingsPage() {
  const element = document.querySelector(".settings-page");
  expect(element).toBeInstanceOf(HTMLDivElement);
  return element as HTMLDivElement;
}

export function acceptOnboarding() {
  click(getPrimaryOverlayButton());
}

export function getPrimaryOverlayButton() {
  const button = document.getElementById("overlay-primary-button");
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

export function getSecondaryOverlayButton() {
  const button = document.getElementById("overlay-secondary-button");
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

export function getTertiaryOverlayButton() {
  const button = document.getElementById("overlay-tertiary-button");
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

export function getInstallOverlayButton() {
  const button = document.getElementById("overlay-install-button");
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

export function setDeterministicRandom(values: number[]) {
  let index = 0;
  vi.spyOn(Math, "random").mockImplementation(() => {
    if (values.length === 0) {
      return 0;
    }

    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  });
}

export async function waitForPlayingState() {
  await advanceUntil(() => gameModel().state === "playing");
}

beforeEach(() => {
  setDesktopDevice();
});
