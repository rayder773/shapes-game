import { describe, expect, it } from "vitest";
import app from "../src/index.ts";
import { createApiTestEnv } from "./helpers.ts";

const testClientId = "11111111-1111-4111-8111-111111111111";

describe("api rate limiting", () => {
  it("limits analytics event ingestion by client ip", async () => {
    const env = createApiTestEnv({ RATE_LIMIT_ANALYTICS_MAX: "1" });
    const requestInit = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.10",
      },
      body: JSON.stringify({
        client_id: testClientId,
        events: [
          {
            type: "game.round_started",
            payload: {},
            client_created_at: "2026-05-28T12:00:00.000Z",
          },
        ],
      }),
    };

    const firstResponse = await app.request("/analytics/events", requestInit, env);
    const secondResponse = await app.request("/analytics/events", requestInit, env);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    await expect(secondResponse.json()).resolves.toEqual({
      ok: false,
      error: "rate_limited",
    });
  });

  it("limits score submissions by client ip", async () => {
    const env = createApiTestEnv({ RATE_LIMIT_SCORES_MAX: "1" });
    const requestInit = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.11",
      },
      body: JSON.stringify({
        client_id: testClientId,
        score: 12,
      }),
    };

    const firstResponse = await app.request("/scores", requestInit, env);
    const secondResponse = await app.request("/scores", requestInit, env);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    await expect(secondResponse.json()).resolves.toEqual({
      ok: false,
      error: "rate_limited",
    });
  });

  it("limits leaderboard reads by client ip", async () => {
    const env = createApiTestEnv({ RATE_LIMIT_LEADERBOARD_MAX: "1" });
    const requestInit = {
      headers: {
        "cf-connecting-ip": "203.0.113.12",
      },
    };

    const firstResponse = await app.request("/leaderboard", requestInit, env);
    const secondResponse = await app.request("/leaderboard", requestInit, env);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    await expect(secondResponse.json()).resolves.toEqual({
      ok: false,
      error: "rate_limited",
    });
  });
});