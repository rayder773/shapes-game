import type { AppReadModel } from "../app/app-read-model.ts";
import { getLocale, getTranslations, type Locale } from "../localization/localization.ts";

export type SettingsPageEvent = { type: "language-change"; locale: Locale } | { type: "close" };
type Listener = (event: SettingsPageEvent) => void;

export type SettingsPageController = {
  element: HTMLDivElement;
  render: (model: AppReadModel) => void;
  subscribe: (listener: Listener) => () => void;
};

export function createSettingsPage(): SettingsPageController {
  const root = document.createElement("div"); root.className = "settings-page"; root.hidden = true;
  const listeners = new Set<Listener>();
  function emit(event: SettingsPageEvent): void { for (const listener of listeners) listener(event); }
  function render(model: AppReadModel): void {
    root.hidden = !model.shell.settingsPageVisible; if (root.hidden) return;
    const text = getTranslations();
    root.innerHTML = `<section class="settings-card" aria-labelledby="settings-title"><h1 id="settings-title" class="settings-title">${text.settings.title}</h1>
      <div class="settings-form"><label class="settings-slider settings-language"><span class="settings-slider-label">${text.settings.language}</span>
      <select class="settings-language-select" data-language><option value="ru">${text.locale.ru}</option><option value="en">${text.locale.en}</option></select></label></div>
      <div class="settings-actions"><button type="button" class="settings-button" data-close>${text.action.resume}</button></div></section>`;
    const select = root.querySelector<HTMLSelectElement>("[data-language]");
    if (select) { select.value = getLocale(); select.addEventListener("change", () => emit({ type: "language-change", locale: select.value === "ru" ? "ru" : "en" })); }
    root.querySelector("[data-close]")?.addEventListener("click", () => emit({ type: "close" }));
  }
  return { element: root, render, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
}
