import { describe, expect, test } from "vitest";
import {
  advanceFrames,
  bootApp,
  getCanvasLog,
  keydown,
  playerModel,
  pointerDownCanvasWorld,
  resetCanvasLog,
} from "./helpers";

describe("canvas smoke", () => {
  test("render loop issues canvas API calls on boot, input and restart", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    await bootApp("/shapes-game/");

    let log = getCanvasLog();
    expect(log.some((call) => call.method === "clearRect")).toBe(true);
    expect(log.some((call) => call.method === "beginPath")).toBe(true);
    expect(log.some((call) => call.method === "save")).toBe(true);
    expect(log.some((call) => call.method === "translate")).toBe(true);
    expect(log.some((call) => call.method === "rotate")).toBe(true);
    expect(log.some((call) => call.method === "arc" || call.method === "rect" || call.method === "lineTo")).toBe(true);

    resetCanvasLog();
    keydown("ArrowRight");
    await advanceFrames(3);
    log = getCanvasLog();
    expect(log.length).toBeGreaterThan(0);

    const player = playerModel();
    pointerDownCanvasWorld(player.position.x + 2, player.position.y);
    await advanceFrames(3);
    log = getCanvasLog();
    expect(log.length).toBeGreaterThan(0);
  });
});
