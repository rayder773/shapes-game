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

const nextVisitorEvents = [
  {
    id: 1,
    visitor_id: visitors[0].id,
    type: "game_start",
    payload: { round: 1 },
    client_created_at: "2026-05-11T10:01:00.000Z",
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

      if (isEventsRequest(url, visitors[0].id)) {
        return Response.json({
          ok: true,
          visitor_id: visitors[0].id,
          events: firstVisitorEvents,
          next_before_id: null,
          has_more: false,
        });
      }

      return Response.json({ ok: false }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootApp("/shapes-game/admin");
    await advanceUntil(() => document.querySelector(".admin-page")?.textContent?.includes("game_end") === true);

    expect(fetchMock).toHaveBeenCalledWith("/admin/api/visitors");
    expect(fetchMock).toHaveBeenCalledWith(`/admin/api/visitors/${visitors[0].id}/events?limit=100`);
    expect(document.querySelector(".admin-page")?.textContent).toContain("Vitest Browser");
    expect(document.querySelector(".admin-page")?.textContent).toContain("score");
  });

  test("loads events when another visitor is selected", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/admin/api/visitors") {
        return Response.json({ ok: true, visitors });
      }

      if (isEventsRequest(url, visitors[0].id)) {
        return Response.json({ ok: true, visitor_id: visitors[0].id, events: firstVisitorEvents, has_more: false });
      }

      if (isEventsRequest(url, visitors[1].id)) {
        return Response.json({ ok: true, visitor_id: visitors[1].id, events: secondVisitorEvents, has_more: false });
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

  test("deletes a visitor with related events and refreshes the list", async () => {
    let currentVisitors = [...visitors];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/admin/api/visitors") {
        return Response.json({ ok: true, visitors: currentVisitors });
      }

      if (isEventsRequest(url, visitors[0].id)) {
        return Response.json({ ok: true, visitor_id: visitors[0].id, events: firstVisitorEvents, has_more: false });
      }

      if (isEventsRequest(url, visitors[1].id)) {
        return Response.json({ ok: true, visitor_id: visitors[1].id, events: secondVisitorEvents, has_more: false });
      }

      if (url === `/admin/api/visitors/${visitors[0].id}` && init?.method === "DELETE") {
        currentVisitors = [visitors[1]];
        return Response.json({ ok: true, deleted_visitor_id: visitors[0].id });
      }

      return Response.json({ ok: false }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    await bootApp("/shapes-game/admin");
    await advanceUntil(() => document.querySelector(".admin-page")?.textContent?.includes("game_end") === true);

    const deleteButton = document.querySelector<HTMLButtonElement>(
      `[data-admin-delete-visitor="${visitors[0].id}"]`,
    );
    expect(deleteButton).toBeTruthy();
    click(deleteButton!);

    await advanceUntil(() => document.querySelector(".admin-page")?.textContent?.includes("settings_open") === true);

    expect(fetchMock).toHaveBeenCalledWith(`/admin/api/visitors/${visitors[0].id}`, { method: "DELETE" });
    expect(document.querySelector(".admin-page")?.textContent).not.toContain("game_end");
    expect(document.querySelector(".admin-page")?.textContent).toContain("Second Browser");
  });

  test("loads the next events page when events table is scrolled near the bottom", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/admin/api/visitors") {
        return Response.json({ ok: true, visitors });
      }

      if (isEventsRequest(url, visitors[0].id, null)) {
        return Response.json({
          ok: true,
          visitor_id: visitors[0].id,
          events: firstVisitorEvents,
          next_before_id: firstVisitorEvents[0].id,
          has_more: true,
        });
      }

      if (isEventsRequest(url, visitors[0].id, firstVisitorEvents[0].id)) {
        return Response.json({
          ok: true,
          visitor_id: visitors[0].id,
          events: nextVisitorEvents,
          next_before_id: null,
          has_more: false,
        });
      }

      return Response.json({ ok: false }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await bootApp("/shapes-game/admin");
    await advanceUntil(() => document.querySelector(".admin-page")?.textContent?.includes("game_end") === true);

    const eventsWrap = document.querySelector<HTMLElement>("[data-admin-events-scroll]");
    expect(eventsWrap).toBeTruthy();
    Object.defineProperties(eventsWrap!, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 420 },
    });
    eventsWrap!.dispatchEvent(new Event("scroll"));

    await advanceUntil(() => document.querySelector(".admin-page")?.textContent?.includes("game_start") === true);

    expect(fetchMock).toHaveBeenCalledWith(`/admin/api/visitors/${visitors[0].id}/events?limit=100&before_id=2`);
  });
});

function isEventsRequest(url: string, visitorId: string, beforeId?: number | null): boolean {
  const requestUrl = new URL(url, "https://example.test");
  if (requestUrl.pathname !== `/admin/api/visitors/${visitorId}/events`) {
    return false;
  }

  if (requestUrl.searchParams.get("limit") !== "100") {
    return false;
  }

  if (beforeId !== undefined) {
    return requestUrl.searchParams.get("before_id") === (beforeId === null ? null : String(beforeId));
  }

  return true;
}
