import { identityService } from "../auth/identity-service.ts";
import { logout, signInWithGoogle } from "../auth/auth-api.ts";
import { loadGoogleSdk } from "../auth/auth-card.ts";
import { readLocalBestScore } from "../leaderboard/best-score-sync.ts";
import { navigateToRoute, type AppRoute } from "../platform/router.ts";
import { AdminApiError, verifyAdminAccess } from "./admin-api.ts";
import type { AdminPageController } from "./admin-page.ts";
import { createAdminSettingsPage } from "./admin-settings-page.ts";
import { getTranslations } from "../localization/localization.ts";

export function createAdminShell(analyticsPage: AdminPageController): {
  element: HTMLDivElement; setRoute: (route: AppRoute) => void;
} {
  const root = document.createElement("div"); root.className = "admin-page"; root.hidden = true;
  const settingsPage = createAdminSettingsPage();
  let route: AppRoute = "game";
  let status: "checking" | "signed-out" | "forbidden" | "allowed" | "error" = "checking";
  let email = ""; let busy = false;

  async function check(): Promise<void> {
    if (!identityService.token) { status = "signed-out"; render(); return; }
    status = "checking"; render();
    try { const admin = await verifyAdminAccess(); email = admin.email; status = "allowed"; }
    catch (error) { status = error instanceof AdminApiError && error.code === "forbidden" ? "forbidden" : error instanceof AdminApiError && error.code === "unauthorized" ? "signed-out" : "error"; }
    render();
  }

  async function credential(value: string): Promise<void> {
    busy = true; render();
    try { await signInWithGoogle(value, readLocalBestScore() ?? 0); await check(); }
    catch { status = "error"; }
    finally { busy = false; render(); }
  }

  async function mountGoogleButton(): Promise<void> {
    const slot = root.querySelector<HTMLElement>("[data-admin-google]");
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim(); if (!slot || !clientId) return;
    try {
      const accounts = await loadGoogleSdk(); if (!slot.isConnected) return;
      accounts.id.initialize({ client_id: clientId, callback: (response) => { if (response.credential) void credential(response.credential); } });
      accounts.id.renderButton(slot, { type: "standard", theme: "filled_blue", size: "large", shape: "pill" });
    } catch { status = "error"; render(); }
  }

  function render(): void {
    const visible = route === "admin" || route === "adminSettings"; root.hidden = !visible;
    if (!visible) { analyticsPage.setVisible(false); settingsPage.setVisible(false); return; }
    const text = getTranslations().admin;
    if (status !== "allowed") {
      analyticsPage.setVisible(false); settingsPage.setVisible(false);
      root.innerHTML = `<section class="admin-auth"><p class="admin-eyebrow">${text.brand}</p><h1>${text.adminLogin}</h1><p>${status === "forbidden" ? text.accessDenied : status === "error" ? text.authError : text.adminLoginHint}</p>
        ${status === "checking" || busy ? `<p>${text.loading}</p>` : status === "signed-out" ? `<div data-admin-google></div>` : ""}
        ${identityService.token ? `<button class="admin-button" data-admin-logout>${text.logout}</button>` : ""}</section>`;
      root.querySelector("[data-admin-logout]")?.addEventListener("click", async () => { await logout(); status = "signed-out"; render(); });
      if (status === "signed-out" && !busy) void mountGoogleButton();
      return;
    }
    root.innerHTML = `<section class="admin-shell"><header class="admin-header"><div><p class="admin-eyebrow">${text.brand}</p><h1>${text.title}</h1><span>${escapeHtml(email)}</span></div><button class="admin-button" data-admin-logout>${text.logout}</button></header>
      <nav class="admin-nav"><button data-admin-route="admin" class="admin-button ${route === "admin" ? "is-active" : ""}">${text.analytics}</button><button data-admin-route="adminSettings" class="admin-button ${route === "adminSettings" ? "is-active" : ""}">${text.gameSettings}</button></nav>
      <div data-admin-content></div></section>`;
    const content = root.querySelector("[data-admin-content]"); if (content) content.append(analyticsPage.element, settingsPage.element);
    analyticsPage.setVisible(route === "admin"); settingsPage.setVisible(route === "adminSettings");
    root.querySelectorAll<HTMLElement>("[data-admin-route]").forEach((button) => button.addEventListener("click", () => navigateToRoute(button.dataset.adminRoute as AppRoute)));
    root.querySelector("[data-admin-logout]")?.addEventListener("click", async () => { await logout(); status = "signed-out"; render(); });
  }

  identityService.subscribe(() => { if ((route === "admin" || route === "adminSettings") && status !== "checking") void check(); });
  return { element: root, setRoute(next) { const entering = route !== "admin" && route !== "adminSettings"; route = next; if ((next === "admin" || next === "adminSettings") && entering) void check(); else render(); } };
}
function escapeHtml(value: string): string { const el = document.createElement("span"); el.textContent = value; return el.innerHTML; }
