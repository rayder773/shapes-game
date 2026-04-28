import type { GameplayProfileKey, GameplaySettingsValues } from "./gameplay-settings.ts";

type SettingsPageOptions = {
  onValueChange: (field: keyof GameplaySettingsValues, value: number) => void;
  onReset: () => void;
  onSave: () => void;
};

type SliderRefs = {
  input: HTMLInputElement;
  value: HTMLSpanElement;
};

const sliderDefinitions: Array<{ field: keyof GameplaySettingsValues; label: string }> = [
  { field: "targetSpeed", label: "Скорость фигур" },
  { field: "playerSpeed", label: "Скорость игрока" },
  { field: "playerBoostSpeed", label: "Скорость скачка" },
  { field: "maxTargets", label: "Максимум фигур" },
  { field: "targetGrowthScoreStep", label: "Шаг увеличения фигур" },
];

export type SettingsPageController = {
  element: HTMLDivElement;
  render: (state: { activeProfileKey: GameplayProfileKey; draft: GameplaySettingsValues }) => void;
  setVisible: (visible: boolean) => void;
};

export function createSettingsPage(options: SettingsPageOptions): SettingsPageController {
  const root = document.createElement("div");
  root.className = "settings-page";
  root.hidden = true;

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
    input.min = "0";
    input.max = "30";
    input.step = "1";
    input.addEventListener("input", () => {
      options.onValueChange(sliderDefinition.field, Number(input.value));
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
  resetButton.addEventListener("click", options.onReset);

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "settings-button";
  saveButton.textContent = "Сохранить и начать игру";
  saveButton.addEventListener("click", options.onSave);

  actions.append(resetButton, saveButton);
  panel.append(actions);

  return {
    element: root,
    render(state) {
      subtitle.textContent = state.activeProfileKey === "compactTouch"
        ? "Редактируется активный мобильный профиль."
        : "Редактируется активный десктопный профиль.";

      for (const sliderDefinition of sliderDefinitions) {
        const refs = sliderRefs.get(sliderDefinition.field);
        if (!refs) continue;

        const value = state.draft[sliderDefinition.field];
        refs.input.value = String(value);
        refs.value.textContent = String(value);
      }
    },
    setVisible(visible) {
      root.hidden = !visible;
    },
  };
}
