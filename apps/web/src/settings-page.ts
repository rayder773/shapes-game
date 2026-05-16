import type { AppReadModel } from "./app-read-model.ts";
import type { GameplaySettingsValues } from "./gameplay-settings.ts";

export type SettingsPageEvent =
  | { type: "settings-change"; field: keyof GameplaySettingsValues; value: number }
  | { type: "settings-reset" }
  | { type: "settings-save" };

type SettingsPageListener = (event: SettingsPageEvent) => void;

type SliderRefs = {
  input: HTMLInputElement;
  value: HTMLSpanElement;
};

const sliderDefinitions: Array<{
  field: keyof GameplaySettingsValues;
  label: string;
  min: number;
  max: number;
  step: number;
  formatValue?: (value: number) => string;
}> = [
  { field: "targetSpeed", label: "Скорость фигур", min: 0, max: 30, step: 1 },
  { field: "playerSpeed", label: "Скорость игрока", min: 0, max: 30, step: 1 },
  { field: "playerBoostSpeed", label: "Скорость скачка", min: 0, max: 30, step: 1 },
  { field: "maxTargets", label: "Максимум фигур", min: 0, max: 30, step: 1 },
  { field: "targetGrowthScoreStep", label: "Шаг увеличения фигур", min: 0, max: 30, step: 1 },
  { field: "lifeSpawnChancePercent", label: "Шанс появления жизни", min: 0, max: 100, step: 1, formatValue: (value) => `${value}%` },
  { field: "startLives", label: "Начальное количество жизней", min: 1, max: 10, step: 1 },
  { field: "maxLives", label: "Максимум жизней", min: 1, max: 10, step: 1 },
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
  heading.textContent = "Настройки";
  panel.append(heading);

  const subtitle = document.createElement("p");
  subtitle.className = "settings-subtitle";
  panel.append(subtitle);

  const form = document.createElement("div");
  form.className = "settings-form";
  panel.append(form);

  const sliderRefs = new Map<keyof GameplaySettingsValues, SliderRefs>();

  for (const sliderDefinition of sliderDefinitions) {
    const row = document.createElement("label");
    row.className = "settings-slider";

    const labelRow = document.createElement("span");
    labelRow.className = "settings-slider-label";

    const label = document.createElement("span");
    label.textContent = sliderDefinition.label;
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
  resetButton.textContent = "Дефолтные значения";
  resetButton.addEventListener("click", () => {
    emit({ type: "settings-reset" });
  });

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "settings-button";
  saveButton.textContent = "Сохранить и начать игру";
  saveButton.addEventListener("click", () => {
    emit({ type: "settings-save" });
  });

  actions.append(resetButton, saveButton);
  panel.append(actions);

  return {
    element: root,
    render(model) {
      root.hidden = !model.shell.settingsPageVisible;

      const settings = model.game.settings;
      if (!settings) return;

      subtitle.textContent = settings.activeProfileKey === "compactTouch"
        ? "Редактируется активный мобильный профиль."
        : "Редактируется активный десктопный профиль.";

      for (const sliderDefinition of sliderDefinitions) {
        const refs = sliderRefs.get(sliderDefinition.field);
        if (!refs) continue;

        const value = settings.draft[sliderDefinition.field];
        refs.input.value = String(value);
        refs.value.textContent = sliderDefinition.formatValue
          ? sliderDefinition.formatValue(value)
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
