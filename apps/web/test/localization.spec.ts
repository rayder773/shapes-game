import { beforeEach, describe, expect, test } from "vitest";
import en from "../src/localization/en.ts";
import ru from "../src/localization/ru.ts";
import {
  detectDeviceLocale,
  getLocale,
  getTranslations,
  initializeLocale,
  setLocale,
} from "../src/localization/localization.ts";
import { bootApp, setDeviceLanguages } from "./helpers.ts";

describe("localization service", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("keeps Russian and English dictionaries in sync", () => {
    function shapeOf(value: unknown): unknown {
      if (typeof value === "function") return "function";
      if (!value || typeof value !== "object") return typeof value;
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shapeOf(item)]));
    }

    expect(shapeOf(ru)).toEqual(shapeOf(en));
  });

  test("detects supported regional locales and falls back to English", () => {
    expect(detectDeviceLocale(["uk-UA", "ru-RU", "en-US"])).toBe("ru");
    expect(detectDeviceLocale(["en-GB"])).toBe("en");
    expect(detectDeviceLocale(["de-DE", "fr-FR"])).toBe("en");
  });

  test("persists the locale, interpolates values, and updates document metadata", () => {
    setLocale("en");

    expect(getLocale()).toBe("en");
    expect(window.localStorage.getItem("anti-match.locale")).toBe("en");
    expect(getTranslations().game.hud.score(12)).toBe("Score: 12");
    expect(getTranslations().leaderboard.currentRank(7)).toBe("Your rank: #7");
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("AntiMatch");

    window.localStorage.setItem("anti-match.locale", "ru");
    expect(initializeLocale()).toBe("ru");
  });
});

describe("localized app", () => {
  test("uses the device locale when no preference is saved", async () => {
    setDeviceLanguages(["en-GB"]);
    await bootApp();

    expect(document.documentElement.lang).toBe("en");
    expect(document.getElementById("hud-score")?.textContent).toBe("Score: 0");
    expect(document.getElementById("overlay-title")?.textContent).toBe("How to play");
  });

  test("saved preference wins and settings switch language immediately", async () => {
    setDeviceLanguages(["ru-RU"]);
    window.localStorage.setItem("anti-match.locale", "en");
    await bootApp("/shapes-game/settings");

    expect(document.querySelector(".settings-title")?.textContent).toBe("Settings");
    const select = document.querySelector<HTMLSelectElement>(".settings-language-select");
    expect(select?.value).toBe("en");

    select!.value = "ru";
    select!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(document.querySelector(".settings-title")?.textContent).toBe("Настройки");
    expect(document.documentElement.lang).toBe("ru");
    expect(window.localStorage.getItem("anti-match.locale")).toBe("ru");
    expect(window.location.pathname).toBe("/shapes-game/settings");
  });

  test("unsupported device locale falls back to English", async () => {
    setDeviceLanguages(["de-DE"]);
    await bootApp();
    expect(document.documentElement.lang).toBe("en");
  });
});
