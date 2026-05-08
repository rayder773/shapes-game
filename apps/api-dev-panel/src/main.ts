type ClientStatus = "none" | "known_visitor" | "unknown_visitor" | "invalid_format";

type ClientInfo = {
  cookie_name: string;
  cookie_value: string | null;
  status: ClientStatus;
};

type VisitorRecord = {
  id: string;
  ip: string;
  user_agent: string;
  created_at: string;
  events_count: number;
};

type EventRecord = {
  id: number;
  visitor_id: string;
  type: string;
  payload: unknown;
  client_created_at: string;
};

type RequestLogEntry = {
  id: number;
  label: string;
  status: number | "network_error";
  response: string;
  time: string;
};

type ScenarioId =
  | "single-event"
  | "batch"
  | "invalid-json"
  | "invalid-date"
  | "oversized-batch"
  | "broken-cookie";

type Scenario = {
  id: ScenarioId;
  label: string;
  description: string;
  editorMode: "json" | "raw" | "none";
};

type RequestPreview = {
  method: string;
  url: string;
  contentType: string | null;
  body: string | null;
};

type AppState = {
  clientInfo: ClientInfo | null;
  visitors: VisitorRecord[];
  selectedVisitorId: string | null;
  selectedVisitorEvents: EventRecord[];
  scenarioId: ScenarioId;
  editors: Record<ScenarioId, string>;
  requestPreview: RequestPreview | null;
  lastResponse: string;
  requestLog: RequestLogEntry[];
  isSending: boolean;
  isDeleting: boolean;
  isUsingVisitor: boolean;
  errorMessage: string | null;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const scenarios: Scenario[] = [
  {
    id: "single-event",
    label: "Send single event",
    description: "One valid analytics event using the current client cookie state.",
    editorMode: "json",
  },
  {
    id: "batch",
    label: "Send batch",
    description: "Two valid events in one request to verify batch insertion.",
    editorMode: "json",
  },
  {
    id: "invalid-json",
    label: "Send invalid json",
    description: "Broken JSON body to hit the invalid_json branch.",
    editorMode: "raw",
  },
  {
    id: "invalid-date",
    label: "Send invalid date",
    description: "Valid JSON with invalid client_created_at.",
    editorMode: "json",
  },
  {
    id: "oversized-batch",
    label: "Send oversized batch",
    description: "More than the default max batch size to hit batch_too_large.",
    editorMode: "none",
  },
  {
    id: "broken-cookie",
    label: "Send with broken cookie",
    description: "Sets an invalid cookie, then sends a valid event to hit invalid_visitor.",
    editorMode: "json",
  },
];

const state: AppState = {
  clientInfo: null,
  visitors: [],
  selectedVisitorId: null,
  selectedVisitorEvents: [],
  scenarioId: "single-event",
  editors: createInitialEditors(),
  requestPreview: null,
  lastResponse: "No requests yet.",
  requestLog: [],
  isSending: false,
  isDeleting: false,
  isUsingVisitor: false,
  errorMessage: null,
};

const rootElement = document.querySelector("main");

if (!rootElement) {
  throw new Error("Main element not found");
}

const root: HTMLElement = rootElement;

root.id = "app";
injectStyles();
void initialize();

async function initialize(): Promise<void> {
  updatePreview();
  render();
  await refreshData();
}

async function refreshData(): Promise<void> {
  state.errorMessage = null;

  try {
    await Promise.all([loadClientInfo(), loadVisitors()]);
    await syncSelectedVisitorEvents();
  } catch (error) {
    state.errorMessage = getErrorMessage(error);
  }

  updatePreview();
  render();
}

async function loadClientInfo(): Promise<void> {
  const response = await fetch("/dev/api/client");
  const payload = (await response.json()) as { ok: boolean } & ClientInfo;

  if (!response.ok || !payload.ok) {
    throw new Error("Failed to load current client state");
  }

  state.clientInfo = {
    cookie_name: payload.cookie_name,
    cookie_value: payload.cookie_value,
    status: payload.status,
  };
}

async function loadVisitors(): Promise<void> {
  const response = await fetch("/dev/api/visitors");
  const payload = (await response.json()) as {
    ok: boolean;
    visitors?: VisitorRecord[];
  };

  if (!response.ok || !payload.ok || !payload.visitors) {
    throw new Error("Failed to load visitors");
  }

  state.visitors = payload.visitors;

  if (!state.selectedVisitorId || !payload.visitors.some((visitor) => visitor.id === state.selectedVisitorId)) {
    state.selectedVisitorId = payload.visitors[0]?.id ?? null;
  }
}

async function syncSelectedVisitorEvents(): Promise<void> {
  if (!state.selectedVisitorId) {
    state.selectedVisitorEvents = [];
    return;
  }

  const response = await fetch(`/dev/api/visitors/${state.selectedVisitorId}/events`);

  if (response.status === 404) {
    state.selectedVisitorEvents = [];
    state.selectedVisitorId = state.visitors[0]?.id ?? null;
    if (state.selectedVisitorId) {
      await syncSelectedVisitorEvents();
    }
    return;
  }

  const payload = (await response.json()) as {
    ok: boolean;
    events?: EventRecord[];
  };

  if (!response.ok || !payload.ok || !payload.events) {
    throw new Error("Failed to load visitor events");
  }

  state.selectedVisitorEvents = payload.events;
}

function render(): void {
  root.innerHTML = `
    <section class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Shapes Game</p>
          <h1>API Dev Panel</h1>
        </div>
        <p class="hero-copy">Send real analytics requests on the left and inspect live visitor state on the right.</p>
      </header>
      ${state.errorMessage ? `<div class="banner error">${escapeHtml(state.errorMessage)}</div>` : ""}
      <div class="layout">
        <section class="panel panel-left">
          <div class="panel-section">
            <div class="section-header">
              <h2>Current Client</h2>
              <span class="badge ${getClientStatusClass(state.clientInfo?.status ?? "none")}">${formatClientStatus(state.clientInfo?.status ?? "none")}</span>
            </div>
            <div class="key-value">
              <span>Cookie name</span>
              <code>${escapeHtml(state.clientInfo?.cookie_name ?? "loading")}</code>
            </div>
            <div class="key-value">
              <span>Cookie value</span>
              <code class="cookie-value">${escapeHtml(state.clientInfo?.cookie_value ?? "none")}</code>
            </div>
            <div class="action-row">
              <button data-client-action="fresh" type="button">Start as fresh client</button>
              <button data-client-action="invalid" type="button">Set broken cookie</button>
            </div>
          </div>

          <div class="panel-section">
            <div class="section-header">
              <h2>Scenarios</h2>
            </div>
            <div class="scenario-list">
              ${scenarios
                .map(
                  (scenario) => `
                    <button
                      data-scenario-id="${scenario.id}"
                      class="scenario-button ${state.scenarioId === scenario.id ? "is-active" : ""}"
                      type="button"
                    >
                      <strong>${escapeHtml(scenario.label)}</strong>
                      <span>${escapeHtml(scenario.description)}</span>
                    </button>
                  `,
                )
                .join("")}
            </div>
          </div>

          <div class="panel-section">
            <div class="section-header">
              <h2>Request</h2>
            </div>
            ${renderScenarioEditor()}
            <div class="preview">
              <p class="preview-label">Preview</p>
              <pre>${escapeHtml(formatPreview(state.requestPreview))}</pre>
            </div>
          </div>

          <div class="panel-section">
            <div class="section-header">
              <h2>Last Response</h2>
            </div>
            <pre class="response-view">${escapeHtml(state.lastResponse)}</pre>
          </div>

          <div class="panel-section">
            <div class="section-header">
              <h2>Request Log</h2>
            </div>
            <div class="log-list">
              ${state.requestLog.length === 0 ? '<p class="empty">No requests yet.</p>' : ""}
              ${state.requestLog
                .map(
                  (entry) => `
                    <article class="log-item">
                      <div class="log-head">
                        <strong>${escapeHtml(entry.label)}</strong>
                        <span>${escapeHtml(String(entry.status))}</span>
                      </div>
                      <p>${escapeHtml(entry.time)}</p>
                      <pre>${escapeHtml(entry.response)}</pre>
                    </article>
                  `,
                )
                .join("")}
            </div>
          </div>
        </section>

        <section class="panel panel-right">
          <div class="panel-section">
            <div class="section-header">
              <h2>Visitors</h2>
              <span class="muted">${state.visitors.length}</span>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Visitor</th>
                    <th>Events</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    state.visitors.length === 0
                      ? '<tr><td colspan="3" class="empty">No visitors yet.</td></tr>'
                      : state.visitors
                          .map(
                            (visitor) => `
                              <tr data-visitor-id="${visitor.id}" class="${visitor.id === state.selectedVisitorId ? "is-selected" : ""}">
                                <td>
                                  <strong>${escapeHtml(shortId(visitor.id))}</strong>
                                  <span class="table-meta">${escapeHtml(visitor.ip || "no ip")}</span>
                                </td>
                                <td>${visitor.events_count}</td>
                                <td>${escapeHtml(formatDateTime(visitor.created_at))}</td>
                              </tr>
                            `,
                          )
                          .join("")
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel-section">
            <div class="section-header">
              <h2>Selected Visitor</h2>
              <div class="action-row compact">
                <button data-use-visitor type="button" ${
                  !state.selectedVisitorId || state.isUsingVisitor ? "disabled" : ""
                }>
                  ${state.isUsingVisitor ? "Using..." : "Use this visitor"}
                </button>
                <button data-delete-visitor type="button" class="danger" ${
                  !state.selectedVisitorId || state.isDeleting ? "disabled" : ""
                }>
                  ${state.isDeleting ? "Deleting..." : "Delete visitor"}
                </button>
              </div>
            </div>
            ${renderSelectedVisitorSummary()}
          </div>

          <div class="panel-section grow">
            <div class="section-header">
              <h2>Events</h2>
              <span class="muted">${state.selectedVisitorEvents.length}</span>
            </div>
            <div class="events-list">
              ${renderEventsList()}
            </div>
          </div>
        </section>
      </div>
      <div class="floating-runbar">
        <button data-run-scenario type="button" class="primary run-button" ${state.isSending ? "disabled" : ""}>
          ${state.isSending ? "Sending..." : "Run scenario"}
        </button>
      </div>
    </section>
  `;

  bindEvents();
}

function renderScenarioEditor(): string {
  const scenario = getScenario(state.scenarioId);

  if (scenario.editorMode === "none") {
    return '<p class="hint">This scenario generates its own request body automatically.</p>';
  }

  const editorValue = state.editors[state.scenarioId];
  const editorLabel = scenario.editorMode === "json" ? "JSON body" : "Raw body";

  return `
    <label class="editor-field">
      <span>${editorLabel}</span>
      <textarea data-request-editor rows="10" spellcheck="false">${escapeHtml(editorValue)}</textarea>
    </label>
  `;
}

function renderSelectedVisitorSummary(): string {
  const visitor = state.visitors.find((item) => item.id === state.selectedVisitorId);

  if (!visitor) {
    return '<p class="empty">Select a visitor to inspect details.</p>';
  }

  return `
    <div class="summary-grid">
      <div class="key-value">
        <span>ID</span>
        <code>${escapeHtml(visitor.id)}</code>
      </div>
      <div class="key-value">
        <span>IP</span>
        <code>${escapeHtml(visitor.ip || "no ip")}</code>
      </div>
      <div class="key-value">
        <span>User-Agent</span>
        <code>${escapeHtml(visitor.user_agent || "no user-agent")}</code>
      </div>
      <div class="key-value">
        <span>Created</span>
        <code>${escapeHtml(formatDateTime(visitor.created_at))}</code>
      </div>
    </div>
  `;
}

function renderEventsList(): string {
  if (!state.selectedVisitorId) {
    return '<p class="empty">No visitor selected.</p>';
  }

  if (state.selectedVisitorEvents.length === 0) {
    return '<p class="empty">This visitor has no events.</p>';
  }

  return state.selectedVisitorEvents
    .map(
      (event) => `
        <article class="event-card">
          <div class="event-head">
            <div class="event-title">
              <span class="event-label">Type</span>
              <strong>${escapeHtml(event.type)}</strong>
            </div>
            <span>#${event.id}</span>
          </div>
          <p>${escapeHtml(formatDateTime(event.client_created_at))}</p>
          <pre>${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre>
        </article>
      `,
    )
    .join("");
}

function bindEvents(): void {
  document.querySelectorAll<HTMLElement>("[data-scenario-id]").forEach((element) => {
    element.addEventListener("click", () => {
      const scenarioId = element.dataset.scenarioId as ScenarioId;
      state.scenarioId = scenarioId;
      updatePreview();
      render();
    });
  });

  document.querySelector<HTMLTextAreaElement>("[data-request-editor]")?.addEventListener("input", (event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLTextAreaElement)) {
      return;
    }

    state.editors[state.scenarioId] = target.value;
    updatePreview();
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-client-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.clientAction;
      if (!action) {
        return;
      }

      await runClientAction(action);
    });
  });

  document.querySelector<HTMLButtonElement>("[data-run-scenario]")?.addEventListener("click", async () => {
    await runScenario();
  });

  document.querySelectorAll<HTMLTableRowElement>("[data-visitor-id]").forEach((row) => {
    row.addEventListener("click", async () => {
      const visitorId = row.dataset.visitorId;
      if (!visitorId || visitorId === state.selectedVisitorId) {
        return;
      }

      state.selectedVisitorId = visitorId;
      render();

      try {
        await syncSelectedVisitorEvents();
      } catch (error) {
        state.errorMessage = getErrorMessage(error);
      }

      render();
    });
  });

  document.querySelector<HTMLButtonElement>("[data-delete-visitor]")?.addEventListener("click", async () => {
    if (!state.selectedVisitorId) {
      return;
    }

    const selectedVisitor = state.visitors.find((visitor) => visitor.id === state.selectedVisitorId);
    const confirmed = window.confirm(
      `Delete visitor ${selectedVisitor ? shortId(selectedVisitor.id) : state.selectedVisitorId} and all related events?`,
    );

    if (!confirmed) {
      return;
    }

    await deleteSelectedVisitor();
  });

  document.querySelector<HTMLButtonElement>("[data-use-visitor]")?.addEventListener("click", async () => {
    await useSelectedVisitor();
  });
}

async function runClientAction(action: string): Promise<void> {
  state.errorMessage = null;

  try {
    const response = await fetch(`/dev/api/client/${action}`, { method: "POST" });
    if (!response.ok) {
      throw new Error(`Failed to set client action: ${action}`);
    }

    await refreshData();
  } catch (error) {
    state.errorMessage = getErrorMessage(error);
    render();
  }
}

async function runScenario(): Promise<void> {
  state.errorMessage = null;
  state.isSending = true;
  render();

  const scenario = getScenario(state.scenarioId);

  try {
    if (scenario.id === "broken-cookie") {
      await runClientAction("invalid");
    }

    const request = buildScenarioRequest(scenario.id);
    const response = await fetch(request.url, {
      method: request.method,
      body: request.body,
      headers: request.contentType ? { "content-type": request.contentType } : undefined,
    });
    const responseText = await response.text();

    state.lastResponse = formatResponse(response.status, responseText);
    pushRequestLog({
      label: scenario.label,
      status: response.status,
      response: responseText,
    });

    await refreshData();
  } catch (error) {
    const message = getErrorMessage(error);
    state.lastResponse = `Network error\n${message}`;
    state.errorMessage = message;
    pushRequestLog({
      label: scenario.label,
      status: "network_error",
      response: message,
    });
    render();
  } finally {
    state.isSending = false;
    render();
  }
}

async function deleteSelectedVisitor(): Promise<void> {
  if (!state.selectedVisitorId) {
    return;
  }

  state.errorMessage = null;
  state.isDeleting = true;
  render();

  try {
    const response = await fetch(`/dev/api/visitors/${state.selectedVisitorId}`, {
      method: "DELETE",
    });
    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(responseText || "Failed to delete visitor");
    }

    state.lastResponse = formatResponse(response.status, responseText);
    pushRequestLog({
      label: "Delete visitor",
      status: response.status,
      response: responseText,
    });

    await refreshData();
  } catch (error) {
    const message = getErrorMessage(error);
    state.errorMessage = message;
    state.lastResponse = `Delete failed\n${message}`;
    render();
  } finally {
    state.isDeleting = false;
    render();
  }
}

async function useSelectedVisitor(): Promise<void> {
  if (!state.selectedVisitorId) {
    return;
  }

  state.errorMessage = null;
  state.isUsingVisitor = true;
  render();

  try {
    const response = await fetch(`/dev/api/client/visitor/${state.selectedVisitorId}`, {
      method: "POST",
    });
    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(responseText || "Failed to use selected visitor");
    }

    state.lastResponse = formatResponse(response.status, responseText);
    pushRequestLog({
      label: "Use this visitor",
      status: response.status,
      response: responseText,
    });

    await refreshData();
  } catch (error) {
    const message = getErrorMessage(error);
    state.errorMessage = message;
    state.lastResponse = `Use visitor failed\n${message}`;
    render();
  } finally {
    state.isUsingVisitor = false;
    render();
  }
}

function buildScenarioRequest(scenarioId: ScenarioId): RequestPreview {
  const defaultRequest: RequestPreview = {
    method: "POST",
    url: "/analytics/events",
    contentType: "application/json",
    body: null,
  };

  switch (scenarioId) {
    case "single-event":
    case "batch":
    case "invalid-date":
    case "broken-cookie":
      return {
        ...defaultRequest,
        body: state.editors[scenarioId],
      };
    case "invalid-json":
      return {
        ...defaultRequest,
        body: state.editors[scenarioId],
      };
    case "oversized-batch":
      return {
        ...defaultRequest,
        body: JSON.stringify(createOversizedBatch(), null, 2),
      };
    default:
      return defaultRequest;
  }
}

function updatePreview(): void {
  state.requestPreview = buildScenarioRequest(state.scenarioId);
}

function createInitialEditors(): Record<ScenarioId, string> {
  return {
    "single-event": JSON.stringify(createSingleEvent("panel.single_event"), null, 2),
    batch: JSON.stringify(
      [
        createSingleEvent("panel.batch.start"),
        createSingleEvent("panel.batch.finish"),
      ],
      null,
      2,
    ),
    "invalid-json": "{",
    "invalid-date": JSON.stringify(
      {
        type: "panel.invalid_date",
        payload: { source: "api-dev-panel" },
        client_created_at: "not-a-date",
      },
      null,
      2,
    ),
    "oversized-batch": "",
    "broken-cookie": JSON.stringify(createSingleEvent("panel.broken_cookie"), null, 2),
  };
}

function createSingleEvent(type: string): { type: string; payload: JsonValue; client_created_at: string } {
  return {
    type,
    payload: {
      source: "api-dev-panel",
      timestamp: new Date().toISOString(),
    },
    client_created_at: new Date().toISOString(),
  };
}

function createOversizedBatch(): Array<{ type: string; payload: JsonValue; client_created_at: string }> {
  return Array.from({ length: 51 }, (_, index) => ({
    type: `panel.oversized_batch.${index + 1}`,
    payload: {
      source: "api-dev-panel",
      index: index + 1,
    },
    client_created_at: new Date().toISOString(),
  }));
}

function getScenario(scenarioId: ScenarioId): Scenario {
  const scenario = scenarios.find((item) => item.id === scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }
  return scenario;
}

function formatPreview(preview: RequestPreview | null): string {
  if (!preview) {
    return "No preview available.";
  }

  return [
    `${preview.method} ${preview.url}`,
    preview.contentType ? `content-type: ${preview.contentType}` : null,
    "",
    preview.body ?? "(empty body)",
  ]
    .filter((part) => part !== null)
    .join("\n");
}

function formatResponse(status: number, body: string): string {
  return `Status ${status}\n${body || "(empty body)"}`;
}

function pushRequestLog(entry: Omit<RequestLogEntry, "id" | "time">): void {
  state.requestLog = [
    {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      ...entry,
    },
    ...state.requestLog,
  ].slice(0, 8);
}

function formatClientStatus(status: ClientStatus): string {
  switch (status) {
    case "known_visitor":
      return "Known visitor";
    case "unknown_visitor":
      return "Unknown visitor";
    case "invalid_format":
      return "Invalid cookie";
    case "none":
      return "No cookie";
  }
}

function getClientStatusClass(status: ClientStatus): string {
  switch (status) {
    case "known_visitor":
      return "badge-success";
    case "unknown_visitor":
      return "badge-warning";
    case "invalid_format":
      return "badge-danger";
    case "none":
      return "badge-neutral";
  }
}

function formatDateTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
}

function shortId(value: string): string {
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function injectStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      color-scheme: light;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(255, 190, 120, 0.4), transparent 25rem),
        linear-gradient(180deg, #f7f4ec 0%, #efe6d5 100%);
      color: #1f1b16;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: transparent;
      color: inherit;
    }

    button,
    textarea {
      font: inherit;
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 0.72rem 1rem;
      background: #ddd0bc;
      color: #2d241b;
      cursor: pointer;
      transition: transform 120ms ease, background-color 120ms ease;
    }

    button:hover:enabled {
      transform: translateY(-1px);
      background: #cfbea6;
    }

    button:disabled {
      cursor: default;
      opacity: 0.6;
    }

    button.primary {
      background: #1f6d5b;
      color: #f4efe5;
    }

    button.primary:hover:enabled {
      background: #175547;
    }

    button.danger {
      background: #90373a;
      color: #fff1ef;
    }

    button.danger:hover:enabled {
      background: #74292d;
    }

    code,
    pre,
    textarea {
      font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
    }

    #app {
      width: 100%;
    }

    .shell {
      padding: 2rem;
      padding-bottom: 6.5rem;
    }

    .hero {
      display: flex;
      justify-content: space-between;
      gap: 1.5rem;
      align-items: flex-end;
      margin-bottom: 1.5rem;
    }

    .hero h1,
    .panel h2,
    .scenario-button strong {
      font-family: "Avenir Next Condensed", "Arial Narrow", sans-serif;
      letter-spacing: 0.03em;
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(2.3rem, 4vw, 3.6rem);
      line-height: 0.95;
    }

    .eyebrow {
      margin: 0 0 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.22em;
      font-size: 0.75rem;
      color: #7b6654;
    }

    .hero-copy {
      max-width: 28rem;
      margin: 0;
      color: #54483b;
    }

    .banner {
      margin-bottom: 1rem;
      padding: 0.85rem 1rem;
      border-radius: 1rem;
    }

    .banner.error {
      background: rgba(144, 55, 58, 0.12);
      color: #672528;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(20rem, 0.95fr) minmax(22rem, 1.05fr);
      gap: 1.25rem;
      align-items: start;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-height: 0;
    }

    .panel-left {
      padding-bottom: 1rem;
    }

    .panel-section {
      border: 1px solid rgba(68, 55, 41, 0.12);
      border-radius: 1.4rem;
      padding: 1rem;
      background: rgba(255, 251, 245, 0.85);
      backdrop-filter: blur(12px);
      box-shadow: 0 18px 40px rgba(58, 42, 26, 0.08);
    }

    .panel-section.grow {
      min-height: 18rem;
    }

    .section-header,
    .log-head,
    .event-head,
    .key-value,
    .action-row {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
    }

    .section-header h2 {
      margin: 0;
      font-size: 1.35rem;
    }

    .muted,
    .table-meta,
    .hint,
    .preview-label,
    .empty,
    .log-item p,
    .event-card p {
      color: #6a5a4b;
    }

    .badge {
      border-radius: 999px;
      padding: 0.32rem 0.7rem;
      font-size: 0.82rem;
    }

    .badge-success {
      background: rgba(31, 109, 91, 0.15);
      color: #124a3d;
    }

    .badge-warning {
      background: rgba(184, 116, 34, 0.14);
      color: #845114;
    }

    .badge-danger {
      background: rgba(144, 55, 58, 0.14);
      color: #6d2427;
    }

    .badge-neutral {
      background: rgba(72, 67, 61, 0.12);
      color: #4f473f;
    }

    .key-value {
      align-items: start;
      margin-top: 0.6rem;
    }

    .key-value span {
      min-width: 6rem;
      color: #6a5a4b;
    }

    .key-value code {
      overflow-wrap: anywhere;
      text-align: right;
    }

    .cookie-value {
      max-width: 20rem;
    }

    .action-row {
      flex-wrap: wrap;
      justify-content: flex-start;
      margin-top: 1rem;
    }

    .action-row.compact {
      margin-top: 0;
      justify-content: flex-end;
    }

    .scenario-list {
      display: grid;
      gap: 0.7rem;
    }

    .scenario-button {
      width: 100%;
      text-align: left;
      border-radius: 1.2rem;
      padding: 0.9rem 1rem;
      display: grid;
      gap: 0.35rem;
      background: #efe4d1;
    }

    .scenario-button.is-active {
      background: #1f1b16;
      color: #f6f0e3;
    }

    .editor-field {
      display: grid;
      gap: 0.5rem;
      margin-top: 0.8rem;
    }

    textarea,
    pre {
      width: 100%;
      margin: 0;
      border-radius: 1rem;
      border: 1px solid rgba(72, 67, 61, 0.18);
      background: #fbf7f0;
      color: #2b241e;
      padding: 0.9rem;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    textarea {
      resize: vertical;
      min-height: 14rem;
    }

    .preview,
    .response-view,
    .events-list,
    .log-list {
      margin-top: 1rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }

    th,
    td {
      padding: 0.8rem 0.65rem;
      border-bottom: 1px solid rgba(72, 67, 61, 0.12);
      text-align: left;
      vertical-align: top;
    }

    tbody tr {
      cursor: pointer;
    }

    tbody tr.is-selected {
      background: rgba(31, 109, 91, 0.1);
    }

    .summary-grid {
      display: grid;
      gap: 0.6rem;
    }

    .events-list,
    .log-list {
      display: grid;
      gap: 0.8rem;
    }

    .event-card,
    .log-item {
      border-radius: 1rem;
      padding: 0.9rem;
      background: #f6efe3;
    }

    .log-item p,
    .event-card p {
      margin: 0.35rem 0 0.7rem;
      font-size: 0.9rem;
    }

    .event-title {
      display: grid;
      gap: 0.15rem;
    }

    .event-label {
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.68rem;
      color: #7b6654;
    }

    .table-wrap {
      overflow: auto;
    }

    .floating-runbar {
      position: fixed;
      left: 2rem;
      right: 2rem;
      bottom: 1.25rem;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }

    .run-button {
      min-width: min(24rem, 100%);
      box-shadow: 0 18px 36px rgba(19, 52, 44, 0.26);
      pointer-events: auto;
    }

    @media (max-width: 1100px) {
      .layout {
        grid-template-columns: 1fr;
      }

      .hero {
        flex-direction: column;
        align-items: start;
      }

      .floating-runbar {
        left: 1rem;
        right: 1rem;
        bottom: 1rem;
      }
    }

    @media (max-width: 720px) {
      .shell {
        padding: 1rem;
        padding-bottom: 6rem;
      }
    }
  `;
  document.head.append(style);
}
