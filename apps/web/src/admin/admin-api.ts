export type VisitorRecord = {
  id: string;
  ip: string;
  user_agent: string;
  created_at: string;
  events_count: number;
};

export type EventRecord = {
  id: number;
  visitor_id: string;
  type: string;
  payload: unknown;
  client_created_at: string;
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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

export async function loadVisitors(): Promise<VisitorRecord[]> {
  const response = await fetch(apiUrl("/admin/api/visitors"));
  const payload = (await response.json()) as VisitorsResponse;

  if (!response.ok || !payload.ok || !payload.visitors) {
    throw new Error("Не удалось загрузить пользователей");
  }

  return payload.visitors;
}

export async function loadVisitorEvents(visitorId: string, beforeId: number | null = null): Promise<EventPage> {
  const params = new URLSearchParams({ limit: "100" });
  if (beforeId !== null) {
    params.set("before_id", String(beforeId));
  }

  const response = await fetch(apiUrl(`/admin/api/visitors/${encodeURIComponent(visitorId)}/events?${params}`));
  const payload = (await response.json()) as EventsResponse;

  if (!response.ok || !payload.ok || !payload.events) {
    throw new Error("Не удалось загрузить события пользователя");
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
  });

  if (!response.ok) {
    throw new Error("Не удалось удалить пользователя");
  }
}
