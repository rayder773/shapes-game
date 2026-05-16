import { describe, expect, test, vi } from "vitest";
import {
  advanceFrames,
  bootApp,
  click,
  getPauseButton,
  getPrimaryOverlayButton,
  getTertiaryOverlayButton,
} from "./helpers";

describe("game analytics integration", () => {
  test("queues core gameplay transition events with aggregate payloads", async () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "https://analytics.example.test/analytics/events");
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");
    await bootApp("/shapes-game/");
    const { analyticsClient } = await import("../src/platform/analytics-client.ts");

    click(getPauseButton());
    click(getPrimaryOverlayButton());
    click(getPauseButton());
    click(getTertiaryOverlayButton());
    await advanceFrames(2);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const sentEvents = fetchMock.mock.calls.flatMap((call) => {
      const request = (call as unknown[])[1] as RequestInit;
      return (JSON.parse(String(request.body)) as { events: Array<{ type: string; payload: Record<string, unknown> }> }).events;
    });
    const events = [...sentEvents, ...analyticsClient.getQueuedEvents()];
    expect(events.map((event) => event.type)).toEqual([
      "game.round_started",
      "game.round_paused",
      "game.round_resumed",
      "game.round_paused",
      "game.round_restarted",
      "game.round_started",
    ]);

    for (const event of events) {
      expect(event.payload).toEqual(expect.objectContaining({
        session_id: analyticsClient.sessionId,
        round_id: expect.any(String),
        profile_key: "desktop",
        compact_touch: false,
        score: expect.any(Number),
        coins: expect.any(Number),
        lives: expect.any(Number),
        max_lives: expect.any(Number),
        elapsed_ms: expect.any(Number),
      }));
      expect(event.payload).not.toHaveProperty("x");
      expect(event.payload).not.toHaveProperty("y");
      expect(event.payload).not.toHaveProperty("shape");
      expect(event.payload).not.toHaveProperty("color");
      expect(event.payload).not.toHaveProperty("fillStyle");
    }
  });

  test("flushes queued gameplay events when the round is paused", async () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "https://analytics.example.test/analytics/events");
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem("shapes-game.rulesAccepted", "true");

    await bootApp("/shapes-game/");

    click(getPauseButton());

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.events.map((event: { type: string }) => event.type)).toEqual([
      "game.round_started",
      "game.round_paused",
    ]);
  });
});
