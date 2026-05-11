export type AnalyticsEventType =
  | "game.round_started"
  | "game.round_paused"
  | "game.round_resumed"
  | "game.round_restarted"
  | "game.target_consumed"
  | "game.life_lost"
  | "game.life_collected"
  | "game.coin_collected"
  | "game.game_over";

export type AnalyticsPayload = Record<string, unknown>;

export type AnalyticsEvent = {
  type: AnalyticsEventType;
  payload: AnalyticsPayload;
  client_created_at: string;
};

type AnalyticsEnvelope = {
  client_id: string;
  events: AnalyticsEvent[];
};

type AnalyticsTransport = {
  fetch: typeof fetch;
  sendBeacon?: Navigator["sendBeacon"];
};

type AnalyticsStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type AnalyticsClientOptions = {
  endpoint?: string;
  storage?: AnalyticsStorage;
  transport?: AnalyticsTransport;
  now?: () => Date;
  uuid?: () => string;
  flushBatchSize?: number;
  maxStoredEvents?: number;
};

const CLIENT_ID_STORAGE_KEY = "shapes-game.analytics.clientId";
const OUTBOX_STORAGE_KEY = "shapes-game.analytics.outbox";
const DEFAULT_FLUSH_BATCH_SIZE = 20;
const DEFAULT_MAX_STORED_EVENTS = 100;

function createUuid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) => (
    (Number(char) ^ crypto.getRandomValues(new Uint8Array(1))[0]! & 15 >> Number(char) / 4).toString(16)
  ));
}

function readStoredEvents(storage: AnalyticsStorage): AnalyticsEvent[] {
  const rawOutbox = storage.getItem(OUTBOX_STORAGE_KEY);
  if (!rawOutbox) return [];

  try {
    const parsed = JSON.parse(rawOutbox);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((event): event is AnalyticsEvent => (
      typeof event === "object"
      && event !== null
      && typeof event.type === "string"
      && typeof event.client_created_at === "string"
      && typeof event.payload === "object"
      && event.payload !== null
    ));
  } catch {
    return [];
  }
}

function persistStoredEvents(
  storage: AnalyticsStorage,
  events: AnalyticsEvent[],
  maxStoredEvents: number,
): void {
  const cappedEvents = events.slice(-maxStoredEvents);

  if (cappedEvents.length === 0) {
    storage.removeItem(OUTBOX_STORAGE_KEY);
    return;
  }

  try {
    storage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(cappedEvents));
  } catch {
    storage.removeItem(OUTBOX_STORAGE_KEY);
  }
}

export class AnalyticsClient {
  readonly clientId: string;
  readonly sessionId: string;

  private readonly endpoint: string;
  private readonly storage: AnalyticsStorage;
  private readonly transport: AnalyticsTransport;
  private readonly now: () => Date;
  private readonly uuid: () => string;
  private readonly flushBatchSize: number;
  private readonly maxStoredEvents: number;
  private queue: AnalyticsEvent[];
  private activeFetchFlush: Promise<boolean> | null = null;

  constructor(options: AnalyticsClientOptions = {}) {
    this.endpoint = options.endpoint?.trim() ?? "";
    this.storage = options.storage ?? window.localStorage;
    this.transport = options.transport ?? {
      fetch: window.fetch.bind(window),
      sendBeacon: navigator.sendBeacon?.bind(navigator),
    };
    this.now = options.now ?? (() => new Date());
    this.uuid = options.uuid ?? createUuid;
    this.flushBatchSize = options.flushBatchSize ?? DEFAULT_FLUSH_BATCH_SIZE;
    this.maxStoredEvents = options.maxStoredEvents ?? DEFAULT_MAX_STORED_EVENTS;
    this.clientId = this.getOrCreateClientId();
    this.sessionId = this.uuid();
    this.queue = readStoredEvents(this.storage);
    persistStoredEvents(this.storage, [], this.maxStoredEvents);
  }

  startRound(): string {
    return this.uuid();
  }

  trackAnalyticsEvent(type: AnalyticsEventType, payload: AnalyticsPayload): void {
    if (!this.endpoint) return;

    this.queue.push({
      type,
      payload,
      client_created_at: this.now().toISOString(),
    });

    if (this.queue.length >= this.flushBatchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<boolean> {
    if (!this.endpoint || this.queue.length === 0) return true;
    if (this.activeFetchFlush) return this.activeFetchFlush;

    const batch = this.queue.splice(0, this.queue.length);
    this.activeFetchFlush = this.sendWithFetch(batch).then((ok) => {
      if (!ok) {
        this.persistFailedBatch(batch);
      }
      this.activeFetchFlush = null;
      return ok;
    });

    return this.activeFetchFlush;
  }

  flushForLifecycle(): void {
    if (!this.endpoint || this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.queue.length);
    const body = JSON.stringify(this.createEnvelope(batch));

    if (this.transport.sendBeacon) {
      const blob = new Blob([body], { type: "text/plain" });
      if (this.transport.sendBeacon(this.endpoint, blob)) {
        return;
      }
    }

    void this.sendWithFetch(batch, true).then((ok) => {
      if (!ok) {
        this.persistFailedBatch(batch);
      }
    });
  }

  getQueuedEvents(): AnalyticsEvent[] {
    return [...this.queue];
  }

  private getOrCreateClientId(): string {
    const existingClientId = this.storage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existingClientId) return existingClientId;

    const clientId = this.uuid();
    this.storage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
    return clientId;
  }

  private createEnvelope(events: AnalyticsEvent[]): AnalyticsEnvelope {
    return {
      client_id: this.clientId,
      events,
    };
  }

  private async sendWithFetch(events: AnalyticsEvent[], keepalive = false): Promise<boolean> {
    try {
      const response = await this.transport.fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "text/plain",
        },
        body: JSON.stringify(this.createEnvelope(events)),
        keepalive,
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private persistFailedBatch(events: AnalyticsEvent[]): void {
    persistStoredEvents(this.storage, [...readStoredEvents(this.storage), ...events], this.maxStoredEvents);
  }
}

export const analyticsClient = new AnalyticsClient({
  endpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT,
});

export function trackAnalyticsEvent(type: AnalyticsEventType, payload: AnalyticsPayload): void {
  analyticsClient.trackAnalyticsEvent(type, payload);
}

export function startAnalyticsRound(): string {
  return analyticsClient.startRound();
}

export function getAnalyticsSessionId(): string {
  return analyticsClient.sessionId;
}

export function installAnalyticsLifecycleFlush(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      analyticsClient.flushForLifecycle();
    }
  });
  window.addEventListener("pagehide", () => {
    analyticsClient.flushForLifecycle();
  });
}
