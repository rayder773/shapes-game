import { describe, expect, it } from "vitest";
import app from "../src/index.ts";
import { createApiTestEnv, FakeD1Database } from "./helpers.ts";

const testClientId = "22222222-2222-4222-8222-222222222222";

describe("score submission anti-fraud", () => {
  it("rejects suspicious rapid best-score jumps", async () => {
    const database = new FakeD1Database();
    database.seedVisitor({
      id: testClientId,
      created_at: "2026-05-28T11:50:00.000Z",
      best_score: 10,
      best_score_updated_at: new Date().toISOString(),
    });

    const response = await app.request(
      "/scores",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.20",
        },
        body: JSON.stringify({
          client_id: testClientId,
          score: 200,
        }),
      },
      createApiTestEnv({
        DB: database,
        SCORE_ANTI_FRAUD_WINDOW_SECONDS: "300",
        SCORE_ANTI_FRAUD_MAX_DELTA: "25",
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "suspicious_score",
    });
  });

  it("accepts ordinary score improvements inside the same window", async () => {
    const database = new FakeD1Database();
    database.seedVisitor({
      id: testClientId,
      created_at: "2026-05-28T11:50:00.000Z",
      best_score: 10,
      best_score_updated_at: new Date().toISOString(),
    });

    const response = await app.request(
      "/scores",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.21",
        },
        body: JSON.stringify({
          client_id: testClientId,
          score: 24,
        }),
      },
      createApiTestEnv({
        DB: database,
        SCORE_ANTI_FRAUD_WINDOW_SECONDS: "300",
        SCORE_ANTI_FRAUD_MAX_DELTA: "25",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      user_id: testClientId,
      score: 24,
      best_score: 24,
    });
  });
});