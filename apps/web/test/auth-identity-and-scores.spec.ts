import { beforeEach, describe, expect, test, vi } from "vitest";

describe("authenticated identity and scoped best scores", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  test("keeps anonymous and Google records in separate scopes", async () => {
    const { identityService } = await import("../src/auth/identity-service.ts");
    const { readLocalBestScore, saveLocalBestScore } = await import("../src/leaderboard/best-score-sync.ts");

    expect(saveLocalBestScore(12)).toBe(true);
    expect(readLocalBestScore()).toBe(12);
    const firstVisitor = identityService.currentVisitorId;

    identityService.setSession({
      token: "token-token-token-token",
      sessionId: "session-1",
      user: { id: "google-user", displayName: "Player", avatarUrl: null, bestScore: 0 },
    });
    expect(readLocalBestScore()).toBeNull();
    expect(saveLocalBestScore(31)).toBe(true);
    expect(readLocalBestScore()).toBe(31);

    identityService.clearSessionAndRotateVisitor();
    expect(identityService.currentVisitorId).not.toBe(firstVisitor);
    expect(readLocalBestScore()).toBeNull();

    identityService.setSession({
      token: "second-token-token-token",
      sessionId: "session-2",
      user: { id: "google-user", displayName: "Player", avatarUrl: null, bestScore: 31 },
    });
    expect(readLocalBestScore()).toBe(31);
  });

  test("restores a bearer session and refreshes the account snapshot", async () => {
    const { identityService } = await import("../src/auth/identity-service.ts");
    identityService.setSession({
      token: "saved-token-token-token",
      sessionId: "old-session",
      user: { id: "user-1", displayName: "Old name", avatarUrl: null, bestScore: 4 },
    });
    const fetchMock = vi.fn(async () => Response.json({
      ok: true,
      session_id: "restored-session",
      user: { id: "user-1", display_name: "Fresh name", avatar_url: "https://example.test/avatar.png", best_score: 19 },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { restoreSession } = await import("../src/auth/auth-api.ts");

    await expect(restoreSession()).resolves.toMatchObject({ displayName: "Fresh name", bestScore: 19 });
    expect(fetchMock).toHaveBeenCalledWith("/auth/me", {
      headers: { authorization: "Bearer saved-token-token-token" },
    });
    expect(identityService.sessionId).toBe("restored-session");
  });

  test("rotates to a clean anonymous visitor when a saved session is rejected", async () => {
    const { identityService } = await import("../src/auth/identity-service.ts");
    identityService.setSession({
      token: "expired-token-token-token",
      sessionId: "expired-session",
      user: { id: "user-1", displayName: "Player", avatarUrl: null, bestScore: 99 },
    });
    const previousVisitor = identityService.currentVisitorId;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(
      { ok: false, error: "invalid_session" },
      { status: 401 },
    )));
    const { restoreSession } = await import("../src/auth/auth-api.ts");

    await expect(restoreSession()).resolves.toBeNull();
    expect(identityService.user).toBeNull();
    expect(identityService.currentVisitorId).not.toBe(previousVisitor);
    expect(identityService.scoreScope).toContain("visitor:");
  });
});
