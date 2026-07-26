import { analyticsClient } from "../platform/analytics-client.ts";

export type LeaderboardEntry = {
  userId: string;
  rank: number;
  score: number;
  publicColorId: string;
  publicNameId: string;
  isCurrentUser: boolean;
};

export type LeaderboardResponse = {
  entries: LeaderboardEntry[];
  currentRank: number | null;
};

type LeaderboardApiEntry = {
  userId: string;
  rank: number;
  score: number;
  publicColorId: string;
  publicNameId: string;
  isCurrentUser: boolean;
};

type LeaderboardApiResponse = {
  ok: boolean;
  entries?: LeaderboardApiEntry[];
  current_rank?: number | null;
};

export type CurrentPlayer = {
  bestScore: number;
  publicColorId: string;
  publicNameId: string;
};

type CurrentPlayerApiResponse = {
  ok: boolean;
  best_score?: unknown;
  public_color_id?: unknown;
  public_name_id?: unknown;
};

type SubmitScoreApiResponse = {
  ok: boolean;
  best_score?: unknown;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

export function isLeaderboardApiConfigured(): boolean {
  return apiBaseUrl.length > 0;
}

export async function ensureCurrentPlayerIdentity(): Promise<CurrentPlayer | null> {
  if (!isLeaderboardApiConfigured()) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      client_id: analyticsClient.clientId,
    });
    const response = await fetch(`${apiBaseUrl}/players/me?${params.toString()}`);

    if (!response.ok) return null;
    const body = await response.json() as CurrentPlayerApiResponse;
    if (
      !body.ok
      || !Number.isInteger(body.best_score)
      || typeof body.public_color_id !== "string"
      || typeof body.public_name_id !== "string"
    ) return null;

    return {
      bestScore: body.best_score as number,
      publicColorId: body.public_color_id,
      publicNameId: body.public_name_id,
    };
  } catch {
    return null;
  }
}

export async function submitLeaderboardScore(score: number): Promise<number | null> {
  if (!isLeaderboardApiConfigured()) {
    return null;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/scores`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_id: analyticsClient.clientId,
        score,
      }),
    });

    if (!response.ok) return null;
    const body = await response.json() as SubmitScoreApiResponse;
    return body.ok && Number.isInteger(body.best_score) ? body.best_score as number : null;
  } catch {
    return null;
  }
}

export async function fetchLeaderboard(options: {
  aroundCurrentUser?: boolean;
  limit?: number;
} = {}): Promise<LeaderboardResponse> {
  if (!isLeaderboardApiConfigured()) {
    return {
      entries: [],
      currentRank: null,
    };
  }

  const params = new URLSearchParams({
    client_id: analyticsClient.clientId,
    around: options.aroundCurrentUser === false ? "top" : "current",
    limit: String(options.limit ?? 20),
  });
  const response = await fetch(`${apiBaseUrl}/leaderboard?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Leaderboard request failed");
  }

  const body = await response.json() as LeaderboardApiResponse;

  if (!body.ok || !Array.isArray(body.entries)) {
    throw new Error("Invalid leaderboard response");
  }

  return {
    entries: body.entries,
    currentRank: body.current_rank ?? null,
  };
}
