import { describe, expect, test } from "vitest";
import {
  acceptOnboarding,
  bootApp,
  click,
  gameModel,
  getSecondaryOverlayButton,
  getSettingsPage,
} from "./helpers";

function getSlider(label: string) {
  const labels = [...document.querySelectorAll(".settings-slider-label")];
  const row = labels.find((element) => element.textContent?.includes(label))?.parentElement;
  const input = row?.querySelector("input");
  expect(input).toBeInstanceOf(HTMLInputElement);
  return input as HTMLInputElement;
}

describe("settings", () => {
  test("renders settings, updates draft, couples lives fields and persists desktop overrides", async () => {
    await bootApp("/shapes-game/");
    acceptOnboarding();
    click(document.getElementById("pause-button") as HTMLButtonElement);
    click(getSecondaryOverlayButton());

    expect(window.location.pathname).toBe("/shapes-game/settings");
    expect(getSettingsPage().hidden).toBe(false);
    expect(document.querySelector(".settings-subtitle")?.textContent).toContain("десктопный");

    const targetSpeed = getSlider("Скорость фигур");
    targetSpeed.value = "7";
    targetSpeed.dispatchEvent(new Event("input", { bubbles: true }));

    const startLives = getSlider("Начальное количество жизней");
    startLives.value = "6";
    startLives.dispatchEvent(new Event("input", { bubbles: true }));

    const maxLives = getSlider("Максимум жизней");
    expect(maxLives.value).toBe("6");
    maxLives.value = "4";
    maxLives.dispatchEvent(new Event("input", { bubbles: true }));
    expect(startLives.value).toBe("4");

    click([...document.querySelectorAll(".settings-button")].find((element) => element.textContent === "Дефолтные значения") as HTMLButtonElement);
    expect(targetSpeed.value).toBe("2");

    targetSpeed.value = "8";
    targetSpeed.dispatchEvent(new Event("input", { bubbles: true }));
    maxLives.value = "7";
    maxLives.dispatchEvent(new Event("input", { bubbles: true }));
    startLives.value = "5";
    startLives.dispatchEvent(new Event("input", { bubbles: true }));

    click([...document.querySelectorAll(".settings-button")].find((element) => element.textContent === "Сохранить и начать игру") as HTMLButtonElement);

    expect(window.location.pathname).toBe("/shapes-game");
    expect(gameModel().gameplayProfile.targetSpeed).toBe(8);
    expect(gameModel().gameplayProfile.startLives).toBe(5);
    expect(gameModel().gameplayProfile.maxLives).toBe(7);

    const saved = JSON.parse(window.localStorage.getItem("shapes-game.gameplaySettings") ?? "{}");
    expect(saved.desktop.targetSpeed).toBe(8);
    expect(saved.desktop.startLives).toBe(5);
    expect(saved.desktop.maxLives).toBe(7);
    expect(saved.compactTouch).toEqual({});

    await bootApp("/shapes-game/");
    expect(gameModel().gameplayProfile.targetSpeed).toBe(8);
    expect(gameModel().gameplayProfile.startLives).toBe(5);
    expect(gameModel().gameplayProfile.maxLives).toBe(7);
  });
});
