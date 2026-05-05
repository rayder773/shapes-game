import { describe, expect, test } from "vitest";
import {
  bootApp,
  getCanvas,
  getPauseButton,
  getSettingsPage,
  snapshot,
} from "./helpers";

describe("app shell and routing", () => {
  test("boots game route with canvas, HUD and hidden settings page", async () => {
    await bootApp("/shapes-game/");

    expect(getCanvas().classList.contains("app-hidden")).toBe(false);
    expect(document.getElementById("hud-score")?.textContent).toBe("Счет: 0");
    expect(getPauseButton().getAttribute("aria-label")).toBe("Продолжить игру");
    expect(getSettingsPage().hidden).toBe(true);
    expect(snapshot().state).toBe("paused");
  });

  test("boots settings route and hides game surface", async () => {
    await bootApp("/shapes-game/settings");

    expect(window.location.pathname).toBe("/shapes-game/settings");
    expect(getCanvas().classList.contains("app-hidden")).toBe(true);
    expect(document.querySelector(".settings-page")?.hasAttribute("hidden")).toBe(false);
    expect(document.getElementById("overlay")?.classList.contains("app-hidden")).toBe(true);
  });

  test("supports SPA fallback query param restoration", async () => {
    await bootApp("/shapes-game/?p=/settings");

    expect(window.location.pathname).toBe("/shapes-game/settings");
    expect(getCanvas().classList.contains("app-hidden")).toBe(true);
  });
});
