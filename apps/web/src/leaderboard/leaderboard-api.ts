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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

export function isLeaderboardApiConfigured(): boolean {
  return apiBaseUrl.length > 0;
}

export async function ensureCurrentPlayerIdentity(): Promise<boolean> {
  if (!isLeaderboardApiConfigured()) {
    return false;
  }

  try {
    const params = new URLSearchParams({
      client_id: analyticsClient.clientId,
    });
    const response = await fetch(`${apiBaseUrl}/players/me?${params.toString()}`);

    return response.ok;
  } catch {
    return false;
  }
}

export async function submitLeaderboardScore(score: number): Promise<boolean> {
  if (!isLeaderboardApiConfigured()) {
    return false;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/scores`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_id: analyticsClient.clientId,
        score: Math.max(0, Math.floor(score)),
      }),
    });

    return response.ok;
  } catch {
    return false;
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
