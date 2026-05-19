import { describe, expect, test, vi } from "vitest";
import {
  bootApp,
  getCanvas,
  getPauseButton,
  appModel,
  gameModel,
} from "./helpers";

describe("app shell and routing", () => {
  test("boots game route with canvas, HUD and hidden settings page", async () => {
    await bootApp("/shapes-game/");

    expect(getCanvas().classList.contains("app-hidden")).toBe(false);
    expect(document.getElementById("hud-score")?.textContent).toBe("Счет: 0");
    expect(getPauseButton().getAttribute("aria-label")).toBe("Продолжить игру");
    expect(appModel().route).toBe("game");
    expect(appModel().shell.gamePageVisible).toBe(true);
    expect(appModel().shell.settingsPageVisible).toBe(false);
    expect(gameModel().state).toBe("paused");
  });

  test("boots settings route and hides game surface", async () => {
    await bootApp("/shapes-game/settings");

    expect(window.location.pathname).toBe("/shapes-game/settings");
    expect(appModel().route).toBe("settings");
    expect(appModel().shell.gamePageVisible).toBe(false);
    expect(appModel().shell.settingsPageVisible).toBe(true);
    expect(appModel().shell.adminPageVisible).toBe(false);
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
    expect(appModel().route).toBe("admin");
    expect(appModel().shell.gamePageVisible).toBe(false);
    expect(appModel().shell.settingsPageVisible).toBe(false);
    expect(appModel().shell.adminPageVisible).toBe(true);
  });

  test("supports SPA fallback query param restoration", async () => {
    await bootApp("/shapes-game/?p=/settings");

    expect(window.location.pathname).toBe("/shapes-game/settings");
    expect(appModel().route).toBe("settings");
    expect(appModel().shell.gamePageVisible).toBe(false);
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
    expect(appModel().route).toBe("admin");
    expect(appModel().shell.adminPageVisible).toBe(true);
  });
});
