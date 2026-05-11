import { describe, expect, test, vi } from "vitest";
import { advanceUntil, bootApp, click } from "./helpers";

const visitors = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    ip: "127.0.0.1",
    user_agent: "Vitest Browser",
    created_at: "2026-05-11T10:00:00.000Z",
    events_count: 2,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    ip: "192.0.2.10",
    user_agent: "Second Browser",
    created_at: "2026-05-11T11:00:00.000Z",
    events_count: 1,
  },
];

const firstVisitorEvents = [
  {
    id: 2,
    visitor_id: visitors[0].id,
    type: "game_end",
    payload: { score: 42 },
    client_created_at: "2026-05-11T10:05:00.000Z",
  },
];

const secondVisitorEvents = [
  {
    id: 3,
    visitor_id: visitors[1].id,
    type: "settings_open",
    payload: { source: "hud" },
    client_created_at: "2026-05-11T11:05:00.000Z",
  },
];

describe("admin page", () => {
  test("loads visitors, selects the first visitor and renders its events", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/admin/api/visitors") {
        return Response.json({ ok: true, visitors });
      }

      if (url === `/admin/api/visitors/${visitors[0].id}/events`) {
        return Response.json({ ok: true, visitor_id: visitors[0].id, events: firstVisitorEvents });
      }

      return Response.json({ ok: false }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootApp("/shapes-game/admin");
    await advanceUntil(() => document.querySelector(".admin-page")?.textContent?.includes("game_end") === true);

    expect(fetchMock).toHaveBeenCalledWith("/admin/api/visitors");
    expect(fetchMock).toHaveBeenCalledWith(`/admin/api/visitors/${visitors[0].id}/events`);
    expect(document.querySelector(".admin-page")?.textContent).toContain("Vitest Browser");
    expect(document.querySelector(".admin-page")?.textContent).toContain("score");
  });

  test("loads events when another visitor is selected", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/admin/api/visitors") {
        return Response.json({ ok: true, visitors });
      }

      if (url === `/admin/api/visitors/${visitors[0].id}/events`) {
        return Response.json({ ok: true, visitor_id: visitors[0].id, events: firstVisitorEvents });
      }

      if (url === `/admin/api/visitors/${visitors[1].id}/events`) {
        return Response.json({ ok: true, visitor_id: visitors[1].id, events: secondVisitorEvents });
      }

      return Response.json({ ok: false }, { status: 404 });
    }));

    await bootApp("/shapes-game/admin");
    await advanceUntil(() => document.querySelector(".admin-page")?.textContent?.includes("game_end") === true);

    const secondVisitorRow = document.querySelector<HTMLTableRowElement>(`[data-admin-visitor-id="${visitors[1].id}"]`);
    expect(secondVisitorRow).toBeTruthy();
    click(secondVisitorRow!);

    await advanceUntil(() => document.querySelector(".admin-page")?.textContent?.includes("settings_open") === true);
  });

  test("renders empty visitors state", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/admin/api/visitors") {
        return Response.json({ ok: true, visitors: [] });
      }

      return Response.json({ ok: false }, { status: 404 });
    }));

    await bootApp("/shapes-game/admin");
    await advanceUntil(() => document.querySelector(".admin-page")?.textContent?.includes("Пользователей пока нет.") === true);
  });

  test("renders api error state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: false }, { status: 500 })));

    await bootApp("/shapes-game/admin");
    await advanceUntil(() => document.querySelector(".admin-page")?.textContent?.includes("Не удалось загрузить пользователей") === true);
  });
});
