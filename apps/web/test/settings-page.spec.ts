import { describe, expect, test } from "vitest";
import { createSettingsPage, type SettingsPageEvent } from "../src/settings/settings-page.ts";
import type { AppReadModel } from "../src/app/app-read-model.ts";

function model(visible = true): AppReadModel {
  return {
    route: visible ? "settings" : "game",
    shell: { gamePageVisible: !visible, settingsPageVisible: visible, adminPageVisible: false },
    game: {} as AppReadModel["game"],
  };
}

describe("language settings page", () => {
  test("renders only language controls and follows visibility", () => {
    const page = createSettingsPage(); document.body.append(page.element); page.render(model());
    expect(page.element.hidden).toBe(false);
    expect(page.element.querySelector(".settings-language-select")).toBeInstanceOf(HTMLSelectElement);
    expect(page.element.querySelectorAll('input[type="range"]')).toHaveLength(0);
    page.render(model(false)); expect(page.element.hidden).toBe(true);
  });

  test("emits language and close events", () => {
    const events: SettingsPageEvent[] = []; const page = createSettingsPage(); page.subscribe((event) => events.push(event));
    document.body.append(page.element); page.render(model());
    const select = page.element.querySelector<HTMLSelectElement>("select")!; select.value = "en"; select.dispatchEvent(new Event("change"));
    page.element.querySelector<HTMLButtonElement>("[data-close]")!.click();
    expect(events).toEqual([{ type: "language-change", locale: "en" }, { type: "close" }]);
  });
});
