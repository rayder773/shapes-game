import { describe, expect, test, vi } from "vitest";
import {
  bootApp,
  getCanvas,
  getPauseButton,
  getSettingsPage,
  gameModel,
} from "./helpers";

describe("app shell and routing", () => {
  test("boots game route with canvas, HUD and hidden settings page", async () => {
    await bootApp("/shapes-game/");

    expect(getCanvas().classList.contains("app-hidden")).toBe(false);
    expect(document.getElementById("hud-score")?.textContent).toBe("Счет: 0");
    expect(getPauseButton().getAttribute("aria-label")).toBe("Продолжить игру");
    expect(getSettingsPage().hidden).toBe(true);
    expect(gameModel().state).toBe("paused");
  });

  test("boots settings route and hides game surface", async () => {
    await bootApp("/shapes-game/settings");

    expect(window.location.pathname).toBe("/shapes-game/settings");
    expect(getCanvas().classList.contains("app-hidden")).toBe(true);
    const settingsPage = document.querySelector<HTMLElement>(".settings-page");
    expect(settingsPage?.hasAttribute("hidden")).toBe(false);
    expect(getComputedStyle(settingsPage!).display).not.toBe("none");
    expect(document.getElementById("overlay")?.classList.contains("app-hidden")).toBe(true);
  });

  test("boots admin route and hides game and settings surfaces", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/admin/api/visitors") {
        return Response.json({ ok: true, visitors: [] });
      }

      return Response.json({ ok: false }, { status: 404 });
    }));

    await bootApp("/shapes-game/admin");

    expect(window.location.pathname).toBe("/shapes-game/admin");
    expect(getCanvas().classList.contains("app-hidden")).toBe(true);
    const settingsPage = document.querySelector<HTMLElement>(".settings-page");
    const adminPage = document.querySelector<HTMLElement>(".admin-page");
    expect(settingsPage?.hasAttribute("hidden")).toBe(true);
    expect(getComputedStyle(settingsPage!).display).toBe("none");
    expect(adminPage?.hasAttribute("hidden")).toBe(false);
    expect(getComputedStyle(adminPage!).display).not.toBe("none");
    expect(document.getElementById("overlay")?.classList.contains("app-hidden")).toBe(true);
  });

  test("supports SPA fallback query param restoration", async () => {
    await bootApp("/shapes-game/?p=/settings");

    expect(window.location.pathname).toBe("/shapes-game/settings");
    expect(getCanvas().classList.contains("app-hidden")).toBe(true);
  });

  test("supports SPA fallback query param restoration for admin", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/admin/api/visitors") {
        return Response.json({ ok: true, visitors: [] });
      }

      return Response.json({ ok: false }, { status: 404 });
    }));

    await bootApp("/shapes-game/?p=/admin");

    expect(window.location.pathname).toBe("/shapes-game/admin");
    expect(document.querySelector(".admin-page")?.hasAttribute("hidden")).toBe(false);
  });
});
