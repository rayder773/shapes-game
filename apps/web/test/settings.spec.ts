import { describe, expect, test } from "vitest";
import { bootApp, click, getSettingsPage } from "./helpers";

describe("settings", () => {
  test("pause settings route exposes language only and returns to game", async () => {
    await bootApp("/shapes-game/settings");
    expect(getSettingsPage().hidden).toBe(false);
    expect(document.querySelectorAll('input[type="range"]')).toHaveLength(0);
    expect(document.querySelector(".settings-language-select")).toBeInstanceOf(HTMLSelectElement);
    click(document.querySelector("[data-close]")!);
    expect(window.location.pathname).toBe("/shapes-game");
  });
});
