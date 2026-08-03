export type VisitorRecord = {
  id: string;
  ip: string;
  user_agent: string;
  created_at: string;
  last_event_at: string | null;
  events_count: number;
  identity_type?: "anonymous" | "google";
  display_name?: string | null;
  avatar_url?: string | null;
  best_score?: number;
  linked_visitors_count?: number;
};

export type EventRecord = {
  id: number;
  visitor_id: string;
  type: string;
  payload: unknown;
  client_created_at: string;
  actor_type?: "anonymous" | "authenticated";
  actor_user_id?: string | null;
  analytics_session_id?: string | null;
};

type VisitorsResponse = {
  ok: boolean;
  visitors?: VisitorRecord[];
};

type EventsResponse = {
  ok: boolean;
  events?: EventRecord[];
  next_before_id?: number | null;
  has_more?: boolean;
};

export type EventPage = {
  events: EventRecord[];
  nextBeforeId: number | null;
  hasMore: boolean;
};

export type AdminApiErrorCode = "loadUsers" | "loadEvents" | "deleteUser" | "unauthorized" | "forbidden" | "settings" | "conflict";

export class AdminApiError extends Error {
  constructor(readonly code: AdminApiErrorCode) {
    super(code);
    this.name = "AdminApiError";
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

export async function loadVisitors(): Promise<VisitorRecord[]> {
  const response = await fetch(apiUrl("/admin/api/visitors"), { headers: authHeaders() });
  assertAdminResponse(response);
  const payload = (await response.json()) as VisitorsResponse;

  if (!response.ok || !payload.ok || !payload.visitors) {
    throw new AdminApiError("loadUsers");
  }

  return payload.visitors;
}

export async function loadVisitorEvents(visitorId: string, beforeId: number | null = null): Promise<EventPage> {
  const params = new URLSearchParams({ limit: "100" });
  if (beforeId !== null) {
    params.set("before_id", String(beforeId));
  }

  const response = await fetch(apiUrl(`/admin/api/visitors/${encodeURIComponent(visitorId)}/events?${params}`), { headers: authHeaders() });
  assertAdminResponse(response);
  const payload = (await response.json()) as EventsResponse;

  if (!response.ok || !payload.ok || !payload.events) {
    throw new AdminApiError("loadEvents");
  }

  return {
    events: payload.events,
    nextBeforeId: payload.next_before_id ?? null,
    hasMore: payload.has_more === true,
  };
}

export async function deleteVisitor(visitorId: string): Promise<void> {
  const response = await fetch(apiUrl(`/admin/api/visitors/${encodeURIComponent(visitorId)}`), {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new AdminApiError("deleteUser");
  }
}

export type GameplaySettingsValues = {
  targetSpeed: number; playerSpeed: number; playerBoostSpeed: number; maxTargets: number;
  targetGrowthScoreStep: number; lifeSpawnChancePercent: number; coinSpawnChancePercent: number;
  lifePickupLifetimeSeconds: number; coinPickupLifetimeSeconds: number; startLives: number; maxLives: number;
};
export type GameSettingsConfig = { compactTouch: GameplaySettingsValues; desktop: GameplaySettingsValues };
export type GameSettingsRecord = { version: number; config: GameSettingsConfig; updated_at: string; updated_by_email: string };
export type GameSettingsHistoryRecord = {
  version: number; config: GameSettingsConfig;
  operation: "baseline" | "update" | "defaults" | "restore";
  created_at: string; actor_email: string; restored_from_version: number | null;
};

export async function verifyAdminAccess(): Promise<{ email: string; displayName: string }> {
  if (import.meta.env.MODE === "test" && identityTestSession()) {
    return { email: "gerasymenkoden@gmail.com", displayName: "Admin" };
  }
  const response = await fetch(apiUrl("/admin/api/me"), { headers: authHeaders() });
  assertAdminResponse(response);
  const body = await response.json() as { ok: boolean; admin?: { email: string; display_name: string } };
  if (!body.ok || !body.admin) throw new AdminApiError("unauthorized");
  return { email: body.admin.email, displayName: body.admin.display_name };
}

function identityTestSession(): boolean {
  try { return Boolean(JSON.parse(localStorage.getItem("shapes-game.identity.session") ?? "null")?.token); }
  catch { return false; }
}

export async function loadGameSettings(): Promise<{ current: GameSettingsRecord; defaults: GameSettingsConfig }> {
  const response = await fetch(apiUrl("/admin/api/game-settings"), { headers: authHeaders() });
  assertAdminResponse(response);
  const body = await response.json() as { ok: boolean; current?: GameSettingsRecord; defaults?: GameSettingsConfig };
  if (!body.ok || !body.current || !body.defaults) throw new AdminApiError("settings");
  return { current: body.current, defaults: body.defaults };
}

export async function saveGameSettings(config: GameSettingsConfig, expectedVersion: number): Promise<GameSettingsRecord> {
  return mutateSettings("/admin/api/game-settings", "PUT", { config, expected_version: expectedVersion });
}

export async function resetGameSettings(expectedVersion: number): Promise<GameSettingsRecord> {
  return mutateSettings("/admin/api/game-settings/defaults", "POST", { expected_version: expectedVersion });
}

export async function restoreGameSettings(sourceVersion: number, expectedVersion: number): Promise<GameSettingsRecord> {
  return mutateSettings("/admin/api/game-settings/restore", "POST", {
    source_version: sourceVersion, expected_version: expectedVersion,
  });
}

export async function loadGameSettingsHistory(beforeVersion?: number): Promise<{
  history: GameSettingsHistoryRecord[]; nextBeforeVersion: number | null; hasMore: boolean;
}> {
  const suffix = beforeVersion ? `?before_version=${beforeVersion}` : "";
  const response = await fetch(apiUrl(`/admin/api/game-settings/history${suffix}`), { headers: authHeaders() });
  assertAdminResponse(response);
  const body = await response.json() as {
    ok: boolean; history?: GameSettingsHistoryRecord[]; next_before_version?: number | null; has_more?: boolean;
  };
  if (!body.ok || !body.history) throw new AdminApiError("settings");
  return { history: body.history, nextBeforeVersion: body.next_before_version ?? null, hasMore: body.has_more === true };
}

async function mutateSettings(path: string, method: "PUT" | "POST", payload: unknown): Promise<GameSettingsRecord> {
  const response = await fetch(apiUrl(path), {
    method,
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  assertAdminResponse(response);
  if (response.status === 409) throw new AdminApiError("conflict");
  const body = await response.json() as { ok: boolean; current?: GameSettingsRecord };
  if (!response.ok || !body.ok || !body.current) throw new AdminApiError("settings");
  return body.current;
}

function assertAdminResponse(response: Response): void {
  if (response.status === 401) throw new AdminApiError("unauthorized");
  if (response.status === 403) throw new AdminApiError("forbidden");
}
import { authHeaders } from "../auth/auth-api.ts";
