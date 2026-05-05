import { describe, expect, test } from "vitest";
import {
  acceptOnboarding,
  blurWindow,
  bootApp,
  click,
  getOverlay,
  getPauseButton,
  getPrimaryOverlayButton,
  keydown,
  setDocumentHidden,
  snapshot,
  waitForPlayingState,
} from "./helpers";

describe("onboarding and pause", () => {
  test("first run shows rules overlay and accepting starts the match", async () => {
    await bootApp("/shapes-game/");

    expect(getOverlay().classList.contains("visible")).toBe(true);
    expect(document.getElementById("overlay-title")?.textContent).toBe("Правила");
    expect(document.getElementById("overlay-tips")?.children).toHaveLength(3);
    expect(snapshot().state).toBe("paused");

    acceptOnboarding();
    await waitForPlayingState();

    expect(window.localStorage.getItem("shapes-game.rulesAccepted")).toBe("true");
    expect(getOverlay().classList.contains("visible")).toBe(false);
    expect(snapshot().state).toBe("playing");
  });

  test("accepted rules suppress onboarding on next boot", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    await bootApp("/shapes-game/");

    expect(getOverlay().classList.contains("visible")).toBe(false);
    expect(snapshot().state).toBe("playing");
  });

  test("pause, resume and autopause flows update overlay and button labels", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    await bootApp("/shapes-game/");

    click(getPauseButton());
    expect(snapshot().state).toBe("paused");
    expect(document.getElementById("overlay-title")?.textContent).toBe("Пауза");
    expect(getPauseButton().getAttribute("aria-label")).toBe("Продолжить игру");
    expect(document.getElementById("overlay-secondary-button")?.textContent).toBe("Настройки");
    expect(document.getElementById("overlay-tertiary-button")?.textContent).toBe("Начать заново");

    click(getPrimaryOverlayButton());
    await waitForPlayingState();
    expect(snapshot().state).toBe("playing");

    keydown("Escape");
    expect(snapshot().state).toBe("paused");
    keydown("Escape");
    await waitForPlayingState();
    expect(snapshot().state).toBe("playing");

    blurWindow();
    expect(snapshot().state).toBe("paused");
    expect(document.getElementById("overlay-message")?.textContent).toBe("Игра остановлена.");
    expect(snapshot().input).toEqual({ up: false, down: false, left: false, right: false });

    click(getPrimaryOverlayButton());
    await waitForPlayingState();
    setDocumentHidden(true);
    expect(snapshot().state).toBe("paused");
  });
});
