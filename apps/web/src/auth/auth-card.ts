import { logout, restoreSession, signInWithGoogle } from "./auth-api.ts";
import { identityService } from "./identity-service.ts";
import { getTranslations, subscribeToLocaleChange } from "../localization/localization.ts";
import { readLocalBestScore, syncBestScore } from "../leaderboard/best-score-sync.ts";

export type GoogleAccounts = {
  id: {
    initialize(options: { client_id: string; callback: (response: { credential?: string }) => void }): void;
    renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  };
};

declare global { interface Window { google?: { accounts?: GoogleAccounts }; } }

let googleSdkPromise: Promise<GoogleAccounts> | null = null;

type AuthCardOptions = {
  googleClientId?: string;
  loadGoogleSdk?: () => Promise<GoogleAccounts>;
  signIn?: typeof signInWithGoogle;
  restore?: typeof restoreSession;
  signOut?: typeof logout;
  syncScore?: typeof syncBestScore;
  readBestScore?: typeof readLocalBestScore;
};

export function createAuthCard(options: AuthCardOptions = {}): {
  element: HTMLElement;
  setVisible: (visible: boolean) => void;
} {
  const root = document.createElement("section");
  root.className = "auth-card";
  root.hidden = true;
  let error: string | null = null;
  let busy = false;
  let visible = false;
  let googleSdkUnavailable = false;

  async function initializeGoogleButton(): Promise<void> {
    const slot = root.querySelector<HTMLElement>("[data-google-button]");
    const clientId = options.googleClientId?.trim() ?? import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    if (!slot || !clientId || identityService.user || !visible || googleSdkUnavailable) return;
    try {
      const accounts = await (options.loadGoogleSdk?.() ?? loadGoogleSdk());
      if (!slot.isConnected || identityService.user) return;
      accounts.id.initialize({
        client_id: clientId,
        callback: (response) => { if (response.credential) void handleCredential(response.credential); },
      });
      accounts.id.renderButton(slot, {
        type: "standard",
        theme: "filled_blue",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "left",
        width: Math.min(320, Math.max(220, slot.clientWidth)),
      });
    } catch {
      googleSdkUnavailable = true;
      error = getTranslations().auth.sdkError;
      render();
    }
  }

  async function handleCredential(credential: string): Promise<void> {
    busy = true; error = null; render();
    try {
      await (options.signIn ?? signInWithGoogle)(
        credential,
        (options.readBestScore ?? readLocalBestScore)() ?? 0,
      );
      await (options.syncScore ?? syncBestScore)();
    } catch {
      error = navigator.onLine ? getTranslations().auth.signInError : getTranslations().auth.offlineError;
    } finally { busy = false; render(); }
  }

  async function handleLogout(): Promise<void> {
    busy = true; error = null; render();
    await (options.signOut ?? logout)();
    busy = false; render();
    await (options.syncScore ?? syncBestScore)();
  }

  function render(): void {
    root.hidden = !visible;
    if (!visible) return;
    const text = getTranslations().auth;
    const user = identityService.user;
    root.innerHTML = user ? `
      <div class="auth-card-heading">
        <span class="auth-card-icon" aria-hidden="true">✓</span>
        <div><strong>${text.connectedTitle}</strong><span>${text.connectedHint}</span></div>
      </div>
      <div class="auth-profile">
        <span class="auth-avatar"><img alt="" referrerpolicy="no-referrer" src="${escapeAttribute(user.avatarUrl ?? "")}"></span>
        <div><strong>${escapeHtml(user.displayName)}</strong><span>${text.signedIn}</span></div>
      </div>
      <div class="auth-actions">
        <button type="button" class="secondary" data-auth-logout ${busy ? "disabled" : ""}>${text.logout}</button>
      </div>
      ${error ? `<p class="auth-error" role="alert">${escapeHtml(error)}</p>` : ""}
    ` : `
      <div class="auth-card-heading">
        <span class="auth-card-icon" aria-hidden="true">↗</span>
        <div><strong>${text.title}</strong><span>${text.intro}</span></div>
      </div>
      <div class="google-signin-slot" data-google-button>${busy ? text.signingIn : ""}</div>
      ${error ? `<p class="auth-error" role="alert">${escapeHtml(error)}</p>` : ""}
    `;
    root.querySelector(".auth-avatar img")?.addEventListener("error", (event) => {
      (event.currentTarget as HTMLImageElement).removeAttribute("src");
    });
    root.querySelector("[data-auth-logout]")?.addEventListener("click", () => void handleLogout());
    if (!user && !busy) void initializeGoogleButton();
  }

  identityService.subscribe(render);
  subscribeToLocaleChange(render);
  if (!/\/admin(?:\/settings)?\/?$/.test(window.location.pathname)) {
    void (options.restore ?? restoreSession)().finally(render);
  }
  return { element: root, setVisible(nextVisible) { visible = nextVisible; render(); } };
}

export function loadGoogleSdk(): Promise<GoogleAccounts> {
  if (window.google?.accounts) return Promise.resolve(window.google.accounts);
  if (googleSdkPromise) return googleSdkPromise;
  googleSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => window.google?.accounts ? resolve(window.google.accounts) : reject(new Error("sdk_missing"));
    script.onerror = () => reject(new Error("sdk_failed"));
    document.head.append(script);
  });
  return googleSdkPromise;
}

function escapeHtml(value: string): string {
  const element = document.createElement("span"); element.textContent = value; return element.innerHTML;
}
function escapeAttribute(value: string): string { return escapeHtml(value).replace(/"/g, "&quot;"); }
