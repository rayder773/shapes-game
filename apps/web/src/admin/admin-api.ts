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
};

export async function loadVisitors(): Promise<VisitorRecord[]> {
  const response = await fetch("/admin/api/visitors");
  const payload = (await response.json()) as VisitorsResponse;

  if (!response.ok || !payload.ok || !payload.visitors) {
    throw new Error("Не удалось загрузить пользователей");
  }

  return payload.visitors;
}

export async function loadVisitorEvents(visitorId: string): Promise<EventRecord[]> {
  const response = await fetch(`/admin/api/visitors/${encodeURIComponent(visitorId)}/events`);
  const payload = (await response.json()) as EventsResponse;

  if (!response.ok || !payload.ok || !payload.events) {
    throw new Error("Не удалось загрузить события пользователя");
  }

  return payload.events;
}
