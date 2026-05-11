import { describe, expect, test, vi } from "vitest";
import { AnalyticsClient, type AnalyticsEvent } from "../src/analytics-client.ts";

const ENDPOINT = "https://analytics.example.test/analytics/events";

function createClient(options: Partial<ConstructorParameters<typeof AnalyticsClient>[0]> = {}) {
  let uuidIndex = 0;
  const uuidValues = [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "00000000-0000-4000-8000-000000000003",
  ];

  return new AnalyticsClient({
    endpoint: ENDPOINT,
    now: () => new Date("2026-05-08T12:00:00.000Z"),
    uuid: () => uuidValues[uuidIndex++] ?? crypto.randomUUID(),
    ...options,
  });
}

function createStoredEvent(index: number): AnalyticsEvent {
  return {
    type: "game.target_consumed",
    payload: { index },
    client_created_at: "2026-05-08T12:00:00.000Z",
  };
}

describe("analytics client", () => {
  test("persists client id and creates a page session id", () => {
    const firstClient = createClient();
    const secondClient = createClient();

    expect(firstClient.clientId).toBe("00000000-0000-4000-8000-000000000001");
    expect(secondClient.clientId).toBe(firstClient.clientId);
    expect(firstClient.sessionId).toBe("00000000-0000-4000-8000-000000000002");
    expect(secondClient.sessionId).toBe("00000000-0000-4000-8000-000000000001");
  });

  test("flushes with fetch when the queue reaches 20 events", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const client = createClient({
      transport: {
        fetch: fetchMock as unknown as typeof fetch,
      },
    });

    for (let index = 0; index < 20; index += 1) {
      client.trackAnalyticsEvent("game.target_consumed", { index });
    }

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.client_id).toBe(client.clientId);
    expect(body.events).toHaveLength(20);
    expect(client.getQueuedEvents()).toHaveLength(0);
  });

  test("loads persisted outbox on startup and clears storage", () => {
    window.localStorage.setItem("shapes-game.analytics.outbox", JSON.stringify([
      createStoredEvent(1),
      createStoredEvent(2),
    ]));

    const client = createClient();

    expect(client.getQueuedEvents()).toHaveLength(2);
    expect(window.localStorage.getItem("shapes-game.analytics.outbox")).toBeNull();
  });

  test("persists failed fetch batches and caps stored events at 100", async () => {
    window.localStorage.setItem("shapes-game.analytics.outbox", JSON.stringify(
      Array.from({ length: 95 }, (_, index) => createStoredEvent(index)),
    ));
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    const client = createClient({
      flushBatchSize: 200,
      transport: {
        fetch: fetchMock as unknown as typeof fetch,
      },
    });

    for (let index = 95; index < 105; index += 1) {
      client.trackAnalyticsEvent("game.target_consumed", { index });
    }
    await client.flush();

    const stored = JSON.parse(window.localStorage.getItem("shapes-game.analytics.outbox") ?? "[]") as AnalyticsEvent[];
    expect(stored).toHaveLength(100);
    expect(stored[0]?.payload).toEqual({ index: 5 });
    expect(stored[99]?.payload).toEqual({ index: 104 });
  });

  test("uses sendBeacon for lifecycle flush and treats successful enqueue as flushed", () => {
    const sendBeacon = vi.fn(() => true);
    const fetchMock = vi.fn();
    const client = createClient({
      transport: {
        fetch: fetchMock as unknown as typeof fetch,
        sendBeacon,
      },
    });

    client.trackAnalyticsEvent("game.round_paused", { score: 1 });
    client.flushForLifecycle();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.getQueuedEvents()).toHaveLength(0);
  });

  test("falls back to keepalive fetch when sendBeacon is unavailable or rejected", async () => {
    const sendBeacon = vi.fn(() => false);
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const client = createClient({
      transport: {
        fetch: fetchMock as unknown as typeof fetch,
        sendBeacon,
      },
    });

    client.trackAnalyticsEvent("game.round_paused", { score: 1 });
    client.flushForLifecycle();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).keepalive).toBe(true);
    expect(client.getQueuedEvents()).toHaveLength(0);
  });
});
