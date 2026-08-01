import { beforeEach, describe, expect, test, vi } from "vitest";

describe("Google authentication card", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    document.body.replaceChildren();
  });

  test("renders the official Google button and keeps the overlay open after sign-in", async () => {
    const { identityService } = await import("../src/auth/identity-service.ts");
    const { createAuthCard } = await import("../src/auth/auth-card.ts");
    const googleState: { credentialCallback?: (response: { credential?: string }) => void } = {};
    const renderButton = vi.fn((slot: HTMLElement) => {
      const button = document.createElement("button");
      button.textContent = "Continue with Google";
      slot.append(button);
    });
    const signIn = vi.fn(async () => {
      const user = { id: "user-1", displayName: "Ada Lovelace", avatarUrl: "https://example.test/ada.png", bestScore: 42 };
      identityService.setSession({ token: "token-token-token-token", sessionId: "session-1", user });
      return user;
    });
    const card = createAuthCard({
      googleClientId: "client.apps.googleusercontent.com",
      loadGoogleSdk: async () => ({
        id: {
          initialize: ({ callback }) => { googleState.credentialCallback = callback; },
          renderButton,
        },
      }),
      restore: async () => null,
      signIn,
      syncScore: async () => 42,
      readBestScore: () => 17,
    });
    document.body.append(card.element);

    card.setVisible(true);
    await vi.waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(card.element.textContent).toContain("Save your progress");

    expect(googleState.credentialCallback).toBeDefined();
    googleState.credentialCallback!({ credential: "signed-google-id-token" });
    await vi.waitFor(() => expect(signIn).toHaveBeenCalledWith("signed-google-id-token", 17));
    await vi.waitFor(() => expect(card.element.textContent).toContain("Ada Lovelace"));
    expect(card.element.hidden).toBe(false);
    expect(card.element.textContent).toContain("Progress is synced");
  });

  test("shows an inline error when Google SDK cannot be loaded", async () => {
    const { createAuthCard } = await import("../src/auth/auth-card.ts");
    const card = createAuthCard({
      googleClientId: "client.apps.googleusercontent.com",
      loadGoogleSdk: async () => { throw new Error("network"); },
      restore: async () => null,
    });
    document.body.append(card.element);

    card.setVisible(true);
    await vi.waitFor(() => expect(card.element.textContent).toContain("Google Sign-In could not be loaded"));
    expect(card.element.querySelector("[role=alert]")).not.toBeNull();
  });

  test("signs out, rotates the anonymous visitor and safely falls back from a broken avatar", async () => {
    const { identityService } = await import("../src/auth/identity-service.ts");
    const { createAuthCard } = await import("../src/auth/auth-card.ts");
    identityService.setSession({
      token: "token-token-token-token",
      sessionId: "session-1",
      user: { id: "user-1", displayName: "Grace Hopper", avatarUrl: "https://example.test/broken.png", bestScore: 8 },
    });
    const previousVisitor = identityService.currentVisitorId;
    const signOut = vi.fn(async () => identityService.clearSessionAndRotateVisitor());
    const card = createAuthCard({ restore: async () => identityService.user, signOut, syncScore: async () => 0 });
    document.body.append(card.element);
    card.setVisible(true);

    const avatar = card.element.querySelector<HTMLImageElement>(".auth-avatar img");
    expect(avatar?.src).toContain("broken.png");
    avatar?.dispatchEvent(new Event("error"));
    expect(avatar?.hasAttribute("src")).toBe(false);

    card.element.querySelector<HTMLButtonElement>("[data-auth-logout]")?.click();
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(identityService.user).toBeNull());
    expect(identityService.currentVisitorId).not.toBe(previousVisitor);
    expect(card.element.textContent).toContain("Save your progress");
  });
});
