import { describe, expect, test } from "vitest";
import {
  acceptOnboarding,
  blurWindow,
  bootApp,
  click,
  getOverlay,
  getPauseButton,
  getPrimaryOverlayButton,
  gameModel,
  keydown,
  setDocumentHidden,
  waitForPlayingState,
} from "./helpers";

describe("onboarding and pause", () => {
  test("first run shows rules overlay and accepting starts the match", async () => {
    await bootApp("/shapes-game/");

    expect(getOverlay().classList.contains("visible")).toBe(true);
    expect(document.getElementById("overlay-title")?.textContent).toBe("Правила");
    expect(document.getElementById("overlay-tips")?.children).toHaveLength(3);
    expect(gameModel().state).toBe("paused");

    acceptOnboarding();
    await waitForPlayingState();

    expect(window.localStorage.getItem("shapes-game.rulesAccepted")).toBe("true");
    expect(getOverlay().classList.contains("visible")).toBe(false);
    expect(gameModel().state).toBe("playing");
  });

  test("accepted rules suppress onboarding on next boot", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    await bootApp("/shapes-game/");

    expect(getOverlay().classList.contains("visible")).toBe(false);
    expect(gameModel().state).toBe("playing");
  });

  test("pause, resume and autopause flows update overlay and button labels", async () => {
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    await bootApp("/shapes-game/");

    click(getPauseButton());
    expect(gameModel().state).toBe("paused");
    expect(document.getElementById("overlay-title")?.textContent).toBe("Пауза");
    expect(getPauseButton().getAttribute("aria-label")).toBe("Продолжить игру");
    expect(document.getElementById("overlay-secondary-button")?.textContent).toBe("Настройки");
    expect(document.getElementById("overlay-tertiary-button")?.textContent).toBe("Начать заново");

    click(getPrimaryOverlayButton());
    await waitForPlayingState();
    expect(gameModel().state).toBe("playing");

    keydown("Escape");
    expect(gameModel().state).toBe("paused");
    keydown("Escape");
    await waitForPlayingState();
    expect(gameModel().state).toBe("playing");

    blurWindow();
    expect(gameModel().state).toBe("paused");
    expect(document.getElementById("overlay-message")?.textContent).toBe("Игра остановлена.");
    expect(gameModel().input).toEqual({ up: false, down: false, left: false, right: false });

    click(getPrimaryOverlayButton());
    await waitForPlayingState();
    setDocumentHidden(true);
    expect(gameModel().state).toBe("paused");
  });
});
