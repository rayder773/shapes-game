import {
  AdminApiError,
  loadGameSettings,
  loadGameSettingsHistory,
  resetGameSettings,
  restoreGameSettings,
  saveGameSettings,
  type GameSettingsConfig,
  type GameSettingsHistoryRecord,
  type GameSettingsRecord,
  type GameplaySettingsValues,
} from "./admin-api.ts";
import { formatDateTime, getTranslations } from "../localization/localization.ts";

type Field = keyof GameplaySettingsValues;
const fields: Array<{ key: Field; min: number; max: number }> = [
  { key: "targetSpeed", min: 0, max: 30 }, { key: "playerSpeed", min: 0, max: 30 },
  { key: "playerBoostSpeed", min: 0, max: 30 }, { key: "maxTargets", min: 0, max: 30 },
  { key: "targetGrowthScoreStep", min: 0, max: 30 }, { key: "lifeSpawnChancePercent", min: 0, max: 100 },
  { key: "coinSpawnChancePercent", min: 0, max: 100 }, { key: "lifePickupLifetimeSeconds", min: 1, max: 10 },
  { key: "coinPickupLifetimeSeconds", min: 1, max: 10 }, { key: "startLives", min: 1, max: 10 },
  { key: "maxLives", min: 1, max: 10 },
];

export function createAdminSettingsPage(): { element: HTMLDivElement; setVisible: (visible: boolean) => void } {
  const root = document.createElement("div");
  root.hidden = true;
  let loaded = false;
  let busy = false;
  let current: GameSettingsRecord | null = null;
  let defaults: GameSettingsConfig | null = null;
  let draft: GameSettingsConfig | null = null;
  let history: GameSettingsHistoryRecord[] = [];
  let nextBeforeVersion: number | null = null;
  let hasMore = false;
  let message: string | null = null;
  let error: string | null = null;

  async function load(): Promise<void> {
    busy = true; error = null; render();
    try {
      const [settings, historyPage] = await Promise.all([loadGameSettings(), loadGameSettingsHistory()]);
      current = settings.current; defaults = settings.defaults;
      draft = structuredClone(settings.current.config);
      history = historyPage.history; nextBeforeVersion = historyPage.nextBeforeVersion; hasMore = historyPage.hasMore;
      loaded = true;
    } catch (cause) { error = errorText(cause); }
    finally { busy = false; render(); }
  }

  async function save(mode: "save" | "defaults", restoreVersion?: number): Promise<void> {
    if (!current || !draft || busy) return;
    busy = true; error = null; message = null; render();
    try {
      current = restoreVersion !== undefined
        ? await restoreGameSettings(restoreVersion, current.version)
        : mode === "defaults"
          ? await resetGameSettings(current.version)
          : await saveGameSettings(draft, current.version);
      draft = structuredClone(current.config);
      message = getTranslations().admin.settingsSaved;
      const page = await loadGameSettingsHistory();
      history = page.history; nextBeforeVersion = page.nextBeforeVersion; hasMore = page.hasMore;
    } catch (cause) {
      error = errorText(cause);
      if (cause instanceof AdminApiError && cause.code === "conflict") loaded = false;
    } finally { busy = false; render(); }
  }

  async function loadMore(): Promise<void> {
    if (!nextBeforeVersion || busy) return;
    busy = true; render();
    try {
      const page = await loadGameSettingsHistory(nextBeforeVersion);
      history = [...history, ...page.history]; nextBeforeVersion = page.nextBeforeVersion; hasMore = page.hasMore;
    } catch (cause) { error = errorText(cause); }
    finally { busy = false; render(); }
  }

  function render(): void {
    if (root.hidden) return;
    const text = getTranslations().admin;
    root.innerHTML = `<section class="admin-panel admin-settings-panel">
      <div class="admin-section-header"><div><h2>${text.gameSettings}</h2>${current ? `<span>${text.version} ${current.version} · ${escapeHtml(current.updated_by_email)}</span>` : ""}</div>
      <button class="admin-button" data-settings-reload ${busy ? "disabled" : ""}>${text.refresh}</button></div>
      ${error ? `<div class="admin-banner" role="alert">${escapeHtml(error)}${!loaded ? ` <button class="admin-button" data-settings-reload>${text.refresh}</button>` : ""}</div>` : ""}
      ${message ? `<div class="admin-success" role="status">${escapeHtml(message)}</div>` : ""}
      ${draft ? `<div class="admin-settings-grid">${renderProfile("compactTouch", draft.compactTouch)}${renderProfile("desktop", draft.desktop)}</div>
        <div class="admin-settings-actions"><button class="admin-button" data-settings-defaults ${busy ? "disabled" : ""}>${text.restoreDefaults}</button>
        <button class="admin-button admin-primary" data-settings-save ${busy ? "disabled" : ""}>${text.saveSettings}</button></div>` : busy ? `<p>${text.loading}</p>` : ""}
    </section>
    <section class="admin-panel admin-history-panel"><div class="admin-section-header"><h2>${text.changeHistory}</h2><span>${history.length}${hasMore ? "+" : ""}</span></div>
      <div class="admin-history-list">${history.map(renderHistory).join("") || `<p class="admin-empty">${text.noHistory}</p>`}</div>
      ${hasMore ? `<button class="admin-button" data-history-more ${busy ? "disabled" : ""}>${text.loadMore}</button>` : ""}
    </section>`;
    root.querySelectorAll<HTMLInputElement>("[data-settings-field]").forEach((input) => input.addEventListener("input", () => {
      if (!draft) return;
      const profile = input.dataset.settingsProfile as keyof GameSettingsConfig;
      const field = input.dataset.settingsField as Field;
      draft[profile][field] = Number(input.value);
      if (field === "startLives" && draft[profile].startLives > draft[profile].maxLives) {
        draft[profile].maxLives = draft[profile].startLives;
        syncInput(profile, "maxLives", draft[profile].maxLives);
      }
      if (field === "maxLives" && draft[profile].startLives > draft[profile].maxLives) {
        draft[profile].startLives = draft[profile].maxLives;
        syncInput(profile, "startLives", draft[profile].startLives);
      }
      const output = input.parentElement?.querySelector("output"); if (output) output.textContent = input.value;
    }));
    root.querySelectorAll("[data-settings-reload]").forEach((button) => button.addEventListener("click", () => void load()));
    root.querySelector("[data-settings-save]")?.addEventListener("click", () => void save("save"));
    root.querySelector("[data-settings-defaults]")?.addEventListener("click", () => {
      if (defaults && window.confirm(text.confirmDefaults)) void save("defaults");
    });
    root.querySelector("[data-history-more]")?.addEventListener("click", () => void loadMore());
    root.querySelectorAll<HTMLElement>("[data-history-restore]").forEach((button) => button.addEventListener("click", () => {
      const version = Number(button.dataset.historyRestore);
      if (window.confirm(text.confirmRestore(version))) void save("save", version);
    }));
  }

  function syncInput(profile: keyof GameSettingsConfig, field: Field, value: number): void {
    const input = root.querySelector<HTMLInputElement>(`[data-settings-profile="${profile}"][data-settings-field="${field}"]`);
    if (!input) return;
    input.value = String(value);
    const output = input.parentElement?.querySelector("output"); if (output) output.textContent = String(value);
  }

  function renderProfile(profile: keyof GameSettingsConfig, values: GameplaySettingsValues): string {
    const text = getTranslations();
    return `<fieldset class="admin-profile"><legend>${profile === "compactTouch" ? text.admin.compactTouch : text.admin.desktop}</legend>${fields.map(({ key, min, max }) => `
      <label class="admin-setting"><span>${escapeHtml(text.settings[key])}</span><output>${values[key]}</output>
      <input type="range" min="${min}" max="${max}" step="1" value="${values[key]}" data-settings-profile="${profile}" data-settings-field="${key}"></label>`).join("")}</fieldset>`;
  }

  function renderHistory(item: GameSettingsHistoryRecord): string {
    const text = getTranslations().admin;
    return `<details class="admin-history-item"><summary><strong>${text.version} ${item.version}</strong><span>${text.operations[item.operation]} · ${escapeHtml(item.actor_email)} · ${escapeHtml(formatDateTime(item.created_at))}</span></summary>
      <pre>${escapeHtml(JSON.stringify(item.config, null, 2))}</pre>
      <button class="admin-button" data-history-restore="${item.version}" ${current?.version === item.version ? "disabled" : ""}>${text.restoreVersion}</button></details>`;
  }

  return { element: root, setVisible(visible) { root.hidden = !visible; if (visible && !loaded && !busy) void load(); else render(); } };
}

function errorText(error: unknown): string {
  const text = getTranslations().admin;
  if (error instanceof AdminApiError && error.code === "conflict") return text.settingsConflict;
  return text.settingsError;
}
function escapeHtml(value: string): string { const el = document.createElement("span"); el.textContent = value; return el.innerHTML; }
