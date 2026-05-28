import { describe, expect, it } from "vitest";
import app from "../src/index.ts";
import { createApiTestEnv } from "./helpers.ts";

const adminHeaders = {
  authorization: "Bearer test-admin-token",
};

describe("api happy paths", () => {
  it("records analytics events and lets an authorized admin inspect and delete the visitor", async () => {
    const env = createApiTestEnv({ APP_ENV: "production" });
    const clientId = "33333333-3333-4333-8333-333333333333";

    const ingestResponse = await app.request(
      "/analytics/events",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.30",
        },
        body: JSON.stringify({
          client_id: clientId,
          events: [
            {
              type: "game.round_started",
              payload: { round: 1 },
              client_created_at: "2026-05-28T12:00:00.000Z",
            },
          ],
        }),
      },
      env,
    );

    expect(ingestResponse.status).toBe(200);

    const visitorsResponse = await app.request(
      "/admin/api/visitors",
      { headers: adminHeaders },
      env,
    );
    const visitorsBody = await visitorsResponse.json() as {
      ok: boolean;
      visitors: Array<{ id: string; events_count: number }>;
    };

    expect(visitorsResponse.status).toBe(200);
    expect(visitorsBody.visitors).toHaveLength(1);
    expect(visitorsBody.visitors[0]).toMatchObject({
      id: clientId,
      events_count: 1,
    });

    const eventsResponse = await app.request(
      `/admin/api/visitors/${clientId}/events`,
      { headers: adminHeaders },
      env,
    );
    const eventsBody = await eventsResponse.json() as {
      ok: boolean;
      events: Array<{ type: string; payload: { round: number } }>;
    };

    expect(eventsResponse.status).toBe(200);
    expect(eventsBody.events).toHaveLength(1);
    expect(eventsBody.events[0]).toMatchObject({
      type: "game.round_started",
      payload: { round: 1 },
    });

    const deleteResponse = await app.request(
      `/admin/api/visitors/${clientId}`,
      { method: "DELETE", headers: adminHeaders },
      env,
    );

    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({
      ok: true,
      deleted_visitor_id: clientId,
    });
  });

  it("returns current player identity, persists best score, and centers leaderboard around the current user", async () => {
    const env = createApiTestEnv({ APP_ENV: "production" });
    const topPlayerId = "44444444-4444-4444-8444-444444444444";
    const middlePlayerId = "55555555-5555-4555-8555-555555555555";
    const bottomPlayerId = "66666666-6666-4666-8666-666666666666";

    const meResponse = await app.request(`/players/me?client_id=${middlePlayerId}`, undefined, env);
    const meBody = await meResponse.json() as {
      ok: boolean;
      user_id: string;
      best_score: number;
      public_color_id: string;
      public_name_id: string;
    };

    expect(meResponse.status).toBe(200);
    expect(meBody.ok).toBe(true);
    expect(meBody.user_id).toBe(middlePlayerId);
    expect(meBody.best_score).toBe(0);
    expect(meBody.public_color_id.length).toBeGreaterThan(0);
    expect(meBody.public_name_id.length).toBeGreaterThan(0);

    for (const [clientId, score] of [
      [topPlayerId, 30],
      [middlePlayerId, 20],
      [bottomPlayerId, 10],
    ] as const) {
      const scoreResponse = await app.request(
        "/scores",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "cf-connecting-ip": `203.0.113.${score}`,
          },
          body: JSON.stringify({ client_id: clientId, score }),
        },
        env,
      );

      expect(scoreResponse.status).toBe(200);
    }

    const leaderboardResponse = await app.request(
      `/leaderboard?client_id=${middlePlayerId}&around=current&limit=3`,
      { headers: { "cf-connecting-ip": "203.0.113.99" } },
      env,
    );
    const leaderboardBody = await leaderboardResponse.json() as {
      ok: boolean;
      current_user_id: string;
      current_rank: number;
      entries: Array<{ userId: string; score: number; rank: number; isCurrentUser: boolean }>;
    };

    expect(leaderboardResponse.status).toBe(200);
    expect(leaderboardBody.current_user_id).toBe(middlePlayerId);
    expect(leaderboardBody.current_rank).toBe(2);
    expect(leaderboardBody.entries).toHaveLength(3);
    expect(leaderboardBody.entries.map((entry) => entry.score)).toEqual([30, 20, 10]);
    expect(leaderboardBody.entries.find((entry) => entry.userId === middlePlayerId)?.isCurrentUser).toBe(true);
  });
});