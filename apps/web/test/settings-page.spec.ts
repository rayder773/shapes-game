import { beforeEach, describe, expect, test } from "vitest";
import type { AppReadModel } from "../src/app-read-model.ts";
import type { GameReadModel } from "../src/game-read-model.ts";
import { createSettingsPage, type SettingsPageEvent } from "../src/settings-page.ts";

function createGameplayProfile(): GameReadModel["gameplayProfile"] {
  return {
    compactTouch: false,
    startTargetCount: 3,
    minTargetsAfterScore: 2,
    targetSpeed: 2,
    playerSpeed: 4,
    playerBoostSpeed: 7,
    maxTargets: 8,
    targetGrowthScoreStep: 5,
    lifeSpawnChance: 0.1,
    coinSpawnChance: 0.2,
    startLives: 3,
    maxLives: 5,
    spawnPadding: 1,
    safeSpawnPadding: 2,
  };
}

function createAppModel(overrides: {
  settingsPageVisible?: boolean;
  activeProfileKey?: NonNullable<GameReadModel["settings"]>["activeProfileKey"];
} = {}): AppReadModel {
  return {
    route: overrides.settingsPageVisible === false ? "game" : "settings",
    shell: {
      gamePageVisible: overrides.settingsPageVisible === false,
      settingsPageVisible: overrides.settingsPageVisible ?? true,
      adminPageVisible: false,
    },
    game: {
      state: "paused",
      hud: {
        score: 0,
        coins: 0,
        lives: 3,
        maxLives: 5,
        bestScore: null,
      },
      overlay: {
        mode: null,
        view: null,
      },
      scene: {
        entities: [],
      },
      roundResult: {
        baseScore: 0,
        coinBonus: 0,
        finalScore: 0,
        bestScore: null,
        wasNewBest: false,
      },
      gameplayProfile: createGameplayProfile(),
      input: {
        up: false,
        down: false,
        left: false,
        right: false,
      },
      settings: {
        activeProfileKey: overrides.activeProfileKey ?? "desktop",
        saved: {
          compactTouch: {},
          desktop: {},
        },
        draft: {
          targetSpeed: 8,
          playerSpeed: 4,
          playerBoostSpeed: 7,
          maxTargets: 10,
          targetGrowthScoreStep: 5,
          lifeSpawnChancePercent: 15,
          startLives: 3,
          maxLives: 5,
        },
        defaults: {
          targetSpeed: 2,
          playerSpeed: 4,
          playerBoostSpeed: 7,
          maxTargets: 8,
          targetGrowthScoreStep: 5,
          lifeSpawnChancePercent: 10,
          startLives: 3,
          maxLives: 5,
        },
      },
    },
  };
}

function getSlider(label: string): HTMLInputElement {
  const labels = [...document.querySelectorAll(".settings-slider-label")];
  const row = labels.find((element) => element.textContent?.includes(label))?.parentElement;
  const input = row?.querySelector("input");
  expect(input).toBeInstanceOf(HTMLInputElement);
  return input as HTMLInputElement;
}

function click(element: Element): void {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

describe("settings page adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("renders settings state and visibility from the app read model", () => {
    const page = createSettingsPage();
    document.body.append(page.element);

    page.render(createAppModel());

    expect(page.element.hidden).toBe(false);
    expect(document.querySelector(".settings-subtitle")?.textContent).toContain("десктопный");
    expect(getSlider("Скорость фигур").value).toBe("8");
    expect(getSlider("Шанс появления жизни").value).toBe("15");

    page.render(createAppModel({ settingsPageVisible: false }));

    expect(page.element.hidden).toBe(true);
  });

  test("emits semantic settings events", () => {
    const page = createSettingsPage();
    const events: SettingsPageEvent[] = [];
    page.subscribe((event) => events.push(event));
    document.body.append(page.element);
    page.render(createAppModel());

    const targetSpeed = getSlider("Скорость фигур");
    targetSpeed.value = "11";
    targetSpeed.dispatchEvent(new Event("input", { bubbles: true }));

    click([...document.querySelectorAll(".settings-button")].find((element) => element.textContent === "Дефолтные значения") as HTMLButtonElement);
    click([...document.querySelectorAll(".settings-button")].find((element) => element.textContent === "Сохранить и начать игру") as HTMLButtonElement);

    expect(events).toEqual([
      { type: "settings-change", field: "targetSpeed", value: 11 },
      { type: "settings-reset" },
      { type: "settings-save" },
    ]);
  });
});
