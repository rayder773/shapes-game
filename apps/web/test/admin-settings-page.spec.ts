import { describe, expect, test, vi } from "vitest";
import { createAdminSettingsPage } from "../src/admin/admin-settings-page.ts";
import { advanceUntil, click } from "./helpers";

const profile = {
  targetSpeed: 2, playerSpeed: 5, playerBoostSpeed: 10, maxTargets: 20,
  targetGrowthScoreStep: 3, lifeSpawnChancePercent: 15, coinSpawnChancePercent: 40,
  lifePickupLifetimeSeconds: 3, coinPickupLifetimeSeconds: 3, startLives: 3, maxLives: 5,
};
const config = { compactTouch: { ...profile, maxTargets: 12 }, desktop: profile };

describe("admin game settings page", () => {
  test("loads both profiles and saves an edited version", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/admin/api/game-settings" && !init?.method) return Response.json({
        ok: true, current: { version: 2, config, updated_at: "2026-05-02T12:00:00Z", updated_by_email: "gerasymenkoden@gmail.com" }, defaults: config,
      });
      if (url === "/admin/api/game-settings/history") return Response.json({ ok: true, history: [], has_more: false });
      if (url === "/admin/api/game-settings" && init?.method === "PUT") return Response.json({
        ok: true, current: { version: 3, config: { ...config, desktop: { ...profile, targetSpeed: 9 } }, updated_at: "2026-05-02T12:01:00Z", updated_by_email: "gerasymenkoden@gmail.com" },
      });
      return Response.json({ ok: false }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const page = createAdminSettingsPage(); document.body.append(page.element); page.setVisible(true);
    await advanceUntil(() => page.element.querySelectorAll("fieldset").length === 2);
    const input = page.element.querySelector<HTMLInputElement>('[data-settings-profile="desktop"][data-settings-field="targetSpeed"]')!;
    input.value = "9"; input.dispatchEvent(new Event("input", { bubbles: true }));
    click(page.element.querySelector("[data-settings-save]")!);
    await advanceUntil(() => page.element.textContent?.includes("Версия 3") === true);
    const request = fetchMock.mock.calls.find(([url, init]) => url === "/admin/api/game-settings" && init?.method === "PUT");
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ expected_version: 2, config: { desktop: { targetSpeed: 9 } } });
  });
});
