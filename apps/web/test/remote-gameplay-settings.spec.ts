import { describe, expect, test, vi } from "vitest";
import { loadSavedGameplaySettings, refreshGameplaySettings } from "../src/game/gameplay-settings.ts";

const profile = {
  targetSpeed: 7, playerSpeed: 5, playerBoostSpeed: 10, maxTargets: 18,
  targetGrowthScoreStep: 4, lifeSpawnChancePercent: 20, coinSpawnChancePercent: 50,
  lifePickupLifetimeSeconds: 4, coinPickupLifetimeSeconds: 5, startLives: 3, maxLives: 6,
};

describe("remote gameplay settings", () => {
  test("validates, returns and caches a downloaded configuration", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      ok: true, version: 8, config: { compactTouch: profile, desktop: { ...profile, maxTargets: 24 } },
    })));
    const settings = await refreshGameplaySettings();
    expect(settings?.desktop.maxTargets).toBe(24);
    expect(loadSavedGameplaySettings().compactTouch.targetSpeed).toBe(7);
    expect(JSON.parse(localStorage.getItem("shapes-game.remoteGameplaySettings") ?? "{}").version).toBe(8);
  });

  test("keeps the last cache when the API is unavailable or malformed", async () => {
    localStorage.setItem("shapes-game.remoteGameplaySettings", JSON.stringify({
      version: 7, config: { compactTouch: profile, desktop: profile },
    }));
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, version: 9, config: { desktop: {} } })));
    expect(await refreshGameplaySettings()).toBeNull();
    expect(loadSavedGameplaySettings().desktop.targetSpeed).toBe(7);
  });
});
