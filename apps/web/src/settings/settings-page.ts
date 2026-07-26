import type { AppReadModel } from "../app/app-read-model.ts";
import type { GameplaySettingsValues } from "../game/gameplay-settings.ts";
import {
  getLocale,
  getTranslations,
  type Locale,
  type Translations,
} from "../localization/localization.ts";

export type SettingsPageEvent =
  | { type: "settings-change"; field: keyof GameplaySettingsValues; value: number }
  | { type: "language-change"; locale: Locale }
  | { type: "settings-reset" }
  | { type: "settings-save" };

type SettingsPageListener = (event: SettingsPageEvent) => void;

type SliderRefs = {
  input: HTMLInputElement;
  value: HTMLSpanElement;
};

const sliderDefinitions: Array<{
  field: keyof GameplaySettingsValues;
  label: (translations: Translations) => string;
  min: number;
  max: number;
  step: number;
  formatValue?: (value: number, translations: Translations) => string;
}> = [
  { field: "targetSpeed", label: (text) => text.settings.targetSpeed, min: 0, max: 30, step: 1 },
  { field: "playerSpeed", label: (text) => text.settings.playerSpeed, min: 0, max: 30, step: 1 },
  { field: "playerBoostSpeed", label: (text) => text.settings.playerBoostSpeed, min: 0, max: 30, step: 1 },
  { field: "maxTargets", label: (text) => text.settings.maxTargets, min: 0, max: 30, step: 1 },
  { field: "targetGrowthScoreStep", label: (text) => text.settings.targetGrowthScoreStep, min: 0, max: 30, step: 1 },
  { field: "lifeSpawnChancePercent", label: (text) => text.settings.lifeSpawnChancePercent, min: 0, max: 100, step: 1, formatValue: (value) => `${value}%` },
  { field: "coinSpawnChancePercent", label: (text) => text.settings.coinSpawnChancePercent, min: 0, max: 100, step: 1, formatValue: (value) => `${value}%` },
  { field: "lifePickupLifetimeSeconds", label: (text) => text.settings.lifePickupLifetimeSeconds, min: 1, max: 10, step: 1, formatValue: (value, text) => text.settings.seconds(value) },
  { field: "coinPickupLifetimeSeconds", label: (text) => text.settings.coinPickupLifetimeSeconds, min: 1, max: 10, step: 1, formatValue: (value, text) => text.settings.seconds(value) },
  { field: "startLives", label: (text) => text.settings.startLives, min: 1, max: 10, step: 1 },
  { field: "maxLives", label: (text) => text.settings.maxLives, min: 1, max: 10, step: 1 },
];

export type SettingsPageController = {
  element: HTMLDivElement;
  render: (model: AppReadModel) => void;
  subscribe: (listener: SettingsPageListener) => () => void;
};

export function createSettingsPage(): SettingsPageController {
  const root = document.createElement("div");
  root.className = "settings-page";
  root.hidden = true;
  const listeners = new Set<SettingsPageListener>();

  function emit(event: SettingsPageEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
  }

  const panel = document.createElement("section");
  panel.className = "settings-card";
  panel.setAttribute("aria-labelledby", "settings-title");
  root.append(panel);

  const heading = document.createElement("h1");
  heading.id = "settings-title";
  heading.className = "settings-title";
  panel.append(heading);

  const subtitle = document.createElement("p");
  subtitle.className = "settings-subtitle";
  panel.append(subtitle);

  const form = document.createElement("div");
  form.className = "settings-form";
  panel.append(form);

  const sliderRefs = new Map<keyof GameplaySettingsValues, SliderRefs>();

  const languageRow = document.createElement("label");
  languageRow.className = "settings-slider settings-language";
  const languageLabel = document.createElement("span");
  languageLabel.className = "settings-slider-label";
  const languageSelect = document.createElement("select");
  languageSelect.className = "settings-language-select";
  const russianOption = document.createElement("option");
  russianOption.value = "ru";
  const englishOption = document.createElement("option");
  englishOption.value = "en";
  languageSelect.append(russianOption, englishOption);
  languageSelect.addEventListener("change", () => {
    const locale = languageSelect.value === "ru" ? "ru" : "en";
    emit({ type: "language-change", locale });
  });
  languageRow.append(languageLabel, languageSelect);
  form.append(languageRow);

  for (const sliderDefinition of sliderDefinitions) {
    const row = document.createElement("label");
    row.className = "settings-slider";

    const labelRow = document.createElement("span");
    labelRow.className = "settings-slider-label";

    const label = document.createElement("span");
    label.dataset.settingsLabel = sliderDefinition.field;
    labelRow.append(label);

    const value = document.createElement("span");
    value.className = "settings-slider-value";
    labelRow.append(value);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(sliderDefinition.min);
    input.max = String(sliderDefinition.max);
    input.step = String(sliderDefinition.step);
    input.addEventListener("input", () => {
      emit({ type: "settings-change", field: sliderDefinition.field, value: Number(input.value) });
    });

    row.append(labelRow, input);
    form.append(row);
    sliderRefs.set(sliderDefinition.field, { input, value });
  }

  const actions = document.createElement("div");
  actions.className = "settings-actions";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "settings-button secondary";
  resetButton.addEventListener("click", () => {
    emit({ type: "settings-reset" });
  });

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "settings-button";
  saveButton.addEventListener("click", () => {
    emit({ type: "settings-save" });
  });

  actions.append(resetButton, saveButton);
  panel.append(actions);

  return {
    element: root,
    render(model) {
      const text = getTranslations();
      root.hidden = !model.shell.settingsPageVisible;

      const settings = model.game.settings;
      if (!settings) return;

      heading.textContent = text.settings.title;
      languageLabel.textContent = text.settings.language;
      russianOption.textContent = text.locale.ru;
      englishOption.textContent = text.locale.en;
      languageSelect.value = getLocale();
      resetButton.textContent = text.settings.reset;
      saveButton.textContent = text.settings.save;

      subtitle.textContent = settings.activeProfileKey === "compactTouch"
        ? text.settings.mobileProfile
        : text.settings.desktopProfile;

      for (const sliderDefinition of sliderDefinitions) {
        const refs = sliderRefs.get(sliderDefinition.field);
        if (!refs) continue;

        const label = refs.input.closest(".settings-slider")?.querySelector<HTMLElement>("[data-settings-label]");
        if (label) label.textContent = sliderDefinition.label(text);

        const value = settings.draft[sliderDefinition.field];
        refs.input.value = String(value);
        refs.value.textContent = sliderDefinition.formatValue
          ? sliderDefinition.formatValue(value, text)
          : String(value);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
