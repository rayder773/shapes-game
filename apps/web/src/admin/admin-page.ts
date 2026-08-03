import { AdminApiError, deleteVisitor, loadVisitorEvents, loadVisitors, type EventRecord, type VisitorRecord } from "./admin-api.ts";
import { formatDateTime, getTranslations, subscribeToLocaleChange } from "../localization/localization.ts";

type AdminState = {
  visitors: VisitorRecord[];
  selectedVisitorId: string | null;
  events: EventRecord[];
  eventsNextBeforeId: number | null;
  hasMoreEvents: boolean;
  isLoadingVisitors: boolean;
  isLoadingEvents: boolean;
  isLoadingMoreEvents: boolean;
  deletingVisitorId: string | null;
  errorMessage: string | null;
  hasLoaded: boolean;
};

export type AdminPageController = {
  element: HTMLDivElement;
  setVisible: (visible: boolean) => void;
};

const state: AdminState = {
  visitors: [],
  selectedVisitorId: null,
  events: [],
  eventsNextBeforeId: null,
  hasMoreEvents: false,
  isLoadingVisitors: false,
  isLoadingEvents: false,
  isLoadingMoreEvents: false,
  deletingVisitorId: null,
  errorMessage: null,
  hasLoaded: false,
};

export function createAdminPage(): AdminPageController {
  injectAdminStyles();

  const root = document.createElement("div");
  root.className = "admin-analytics-page";
  root.hidden = true;
  let isVisible = false;

  async function refreshVisitors(): Promise<void> {
    state.isLoadingVisitors = true;
    state.errorMessage = null;
    render();

    try {
      const visitors = await loadVisitors();
      state.visitors = visitors;
      state.hasLoaded = true;

      if (!state.selectedVisitorId || !visitors.some((visitor) => visitor.id === state.selectedVisitorId)) {
        state.selectedVisitorId = visitors[0]?.id ?? null;
      }

      await refreshEvents();
    } catch (error) {
      state.errorMessage = getErrorMessage(error);
      state.events = [];
    } finally {
      state.isLoadingVisitors = false;
      render();
    }
  }

  async function refreshEvents(): Promise<void> {
    if (!state.selectedVisitorId) {
      state.events = [];
      state.eventsNextBeforeId = null;
      state.hasMoreEvents = false;
      return;
    }

    state.isLoadingEvents = true;
    state.isLoadingMoreEvents = false;
    state.errorMessage = null;
    render();

    try {
      const page = await loadVisitorEvents(state.selectedVisitorId);
      state.events = page.events;
      state.eventsNextBeforeId = page.nextBeforeId;
      state.hasMoreEvents = page.hasMore;
    } catch (error) {
      state.errorMessage = getErrorMessage(error);
      state.events = [];
      state.eventsNextBeforeId = null;
      state.hasMoreEvents = false;
    } finally {
      state.isLoadingEvents = false;
      render();
    }
  }

  async function loadMoreEvents(): Promise<void> {
    if (
      !state.selectedVisitorId ||
      !state.hasMoreEvents ||
      state.isLoadingEvents ||
      state.isLoadingMoreEvents ||
      state.eventsNextBeforeId === null
    ) {
      return;
    }

    const visitorId = state.selectedVisitorId;
    const beforeId = state.eventsNextBeforeId;
    state.isLoadingMoreEvents = true;
    state.errorMessage = null;
    render();

    try {
      const page = await loadVisitorEvents(visitorId, beforeId);

      if (state.selectedVisitorId !== visitorId) {
        return;
      }

      state.events = [...state.events, ...page.events];
      state.eventsNextBeforeId = page.nextBeforeId;
      state.hasMoreEvents = page.hasMore;
    } catch (error) {
      state.errorMessage = getErrorMessage(error);
    } finally {
      state.isLoadingMoreEvents = false;
      render();
    }
  }

  async function deleteSelectedVisitor(visitorId: string): Promise<void> {
    const visitor = state.visitors.find((item) => item.id === visitorId);
    const confirmed = window.confirm(
      getTranslations().admin.confirmDelete(visitor ? shortId(visitor.id) : visitorId),
    );

    if (!confirmed) {
      return;
    }

    state.deletingVisitorId = visitorId;
    state.errorMessage = null;
    render();

    try {
      await deleteVisitor(visitorId);

      if (state.selectedVisitorId === visitorId) {
        state.selectedVisitorId = null;
        state.events = [];
        state.eventsNextBeforeId = null;
        state.hasMoreEvents = false;
      }

      await refreshVisitors();
    } catch (error) {
      state.errorMessage = getErrorMessage(error);
    } finally {
      state.deletingVisitorId = null;
      render();
    }
  }

  function render(): void {
    const text = getTranslations();
    root.innerHTML = `
      <section class="admin-shell" aria-labelledby="admin-title">
        <header class="admin-header">
          <div>
            <p class="admin-eyebrow">${text.admin.brand}</p>
            <h1 id="admin-title">${text.admin.title}</h1>
          </div>
          <button class="admin-button" type="button" data-admin-refresh ${state.isLoadingVisitors ? "disabled" : ""}>
            ${state.isLoadingVisitors ? text.admin.loading : text.admin.refresh}
          </button>
        </header>

        ${state.errorMessage ? `<div class="admin-banner" role="alert">${escapeHtml(state.errorMessage)}</div>` : ""}

        <div class="admin-grid">
          <section class="admin-panel" aria-labelledby="admin-users-title">
            <div class="admin-section-header">
              <h2 id="admin-users-title">${text.admin.users}</h2>
              <span>${state.visitors.length}</span>
            </div>
            <div class="admin-table-wrap">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>${text.admin.user}</th>
                    <th>${text.admin.ip}</th>
                    <th>${text.admin.userAgent}</th>
                    <th>${text.admin.events}</th>
                    <th>${text.admin.lastActivity}</th>
                    <th>${text.admin.created}</th>
                    <th>${text.admin.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderVisitorRows()}
                </tbody>
              </table>
            </div>
          </section>

          <section class="admin-panel" aria-labelledby="admin-events-title">
            <div class="admin-section-header">
              <h2 id="admin-events-title">${text.admin.events}</h2>
              <span>${state.events.length}${state.hasMoreEvents ? "+" : ""}</span>
            </div>
            <div class="admin-table-wrap admin-events-wrap" data-admin-events-scroll>
              <table class="admin-table admin-events-table">
                <thead>
                  <tr>
                    <th>${text.admin.id}</th>
                    <th>${text.admin.type}</th>
                    <th>${text.admin.clientTime}</th>
                    <th>${text.admin.payload}</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderEventRows()}
                  ${renderEventsPagingRow()}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    `;

    root.querySelector<HTMLButtonElement>("[data-admin-refresh]")?.addEventListener("click", () => {
      void refreshVisitors();
    });

    root.querySelectorAll<HTMLTableRowElement>("[data-admin-visitor-id]").forEach((row) => {
      row.addEventListener("click", async () => {
        const visitorId = row.dataset.adminVisitorId;
        if (!visitorId || visitorId === state.selectedVisitorId) {
          return;
        }

        state.selectedVisitorId = visitorId;
        state.events = [];
        state.eventsNextBeforeId = null;
        state.hasMoreEvents = false;
        render();
        await refreshEvents();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-admin-delete-visitor]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        const visitorId = button.dataset.adminDeleteVisitor;
        if (!visitorId || state.deletingVisitorId) {
          return;
        }

        await deleteSelectedVisitor(visitorId);
      });
    });

    root.querySelector<HTMLElement>("[data-admin-events-scroll]")?.addEventListener("scroll", (event) => {
      const element = event.currentTarget;
      if (!(element instanceof HTMLElement)) {
        return;
      }

      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 120) {
        void loadMoreEvents();
      }
    });
  }

  function renderVisitorRows(): string {
    const text = getTranslations();
    if (state.isLoadingVisitors && !state.hasLoaded) {
      return `<tr><td colspan="7" class="admin-empty">${text.admin.loadingUsers}</td></tr>`;
    }

    if (state.visitors.length === 0) {
      return `<tr><td colspan="7" class="admin-empty">${text.admin.noUsers}</td></tr>`;
    }

    return state.visitors
      .map(
        (visitor) => {
          const isDeleting = state.deletingVisitorId === visitor.id;
          const isGoogle = visitor.identity_type === "google";

          return `
          <tr data-admin-visitor-id="${escapeHtml(visitor.id)}" class="${visitor.id === state.selectedVisitorId ? "is-selected" : ""}" tabindex="0">
            <td>
              <strong>${escapeHtml(isGoogle ? visitor.display_name ?? shortId(visitor.id) : shortId(visitor.id))}</strong>
              <span class="admin-identity-badge ${isGoogle ? "is-google" : ""}">${isGoogle ? "Google" : "Anonymous"}</span>
              <span class="admin-table-meta">${escapeHtml(visitor.id)}</span>
              ${isGoogle ? `<span class="admin-table-meta">${visitor.linked_visitors_count ?? 0} visitors · best ${visitor.best_score ?? 0}</span>` : ""}
            </td>
            <td>${escapeHtml(visitor.ip || text.admin.noIp)}</td>
            <td class="admin-user-agent">${escapeHtml(visitor.user_agent || text.admin.noUserAgent)}</td>
            <td>${visitor.events_count}</td>
            <td>${escapeHtml(visitor.last_event_at ? formatDateTime(visitor.last_event_at) : text.admin.noEvents)}</td>
            <td>${escapeHtml(formatDateTime(visitor.created_at))}</td>
            <td>
              ${isGoogle ? `<span class="admin-table-meta">${text.admin.readOnly}</span>` : `<button
                class="admin-button admin-button-danger"
                type="button"
                data-admin-delete-visitor="${escapeHtml(visitor.id)}"
                ${isDeleting ? "disabled" : ""}
              >
                ${isDeleting ? text.admin.deleting : text.admin.delete}
              </button>`}
            </td>
          </tr>
        `;
        },
      )
      .join("");
  }

  function renderEventRows(): string {
    const text = getTranslations();
    if (!state.selectedVisitorId) {
      return `<tr><td colspan="4" class="admin-empty">${text.admin.selectUser}</td></tr>`;
    }

    if (state.isLoadingEvents) {
      return `<tr><td colspan="4" class="admin-empty">${text.admin.loadingEvents}</td></tr>`;
    }

    if (state.events.length === 0) {
      return `<tr><td colspan="4" class="admin-empty">${text.admin.userHasNoEvents}</td></tr>`;
    }

    return state.events
      .map(
        (event) => `
          <tr>
            <td>#${event.id}</td>
            <td><strong>${escapeHtml(event.type)}</strong><span class="admin-identity-badge ${event.actor_type === "authenticated" ? "is-google" : ""}">${event.actor_type === "authenticated" ? (event.actor_user_id ? "Authenticated" : "Authenticated (deleted)") : "Anonymous"}</span><span class="admin-table-meta">${escapeHtml(event.visitor_id)}</span></td>
            <td>${escapeHtml(formatDateTime(event.client_created_at))}</td>
            <td><pre>${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre></td>
          </tr>
        `,
      )
      .join("");
  }

  function renderEventsPagingRow(): string {
    const text = getTranslations();
    if (!state.selectedVisitorId || state.isLoadingEvents) {
      return "";
    }

    if (state.isLoadingMoreEvents) {
      return `<tr><td colspan="4" class="admin-empty">${text.admin.loadingMoreEvents}</td></tr>`;
    }

    if (state.hasMoreEvents) {
      return `<tr><td colspan="4" class="admin-empty">${text.admin.scrollForMore}</td></tr>`;
    }

    if (state.events.length > 0) {
      return `<tr><td colspan="4" class="admin-empty">${text.admin.allEventsLoaded}</td></tr>`;
    }

    return "";
  }

  render();
  subscribeToLocaleChange(() => render());

  return {
    element: root,
    setVisible(visible) {
      root.hidden = !visible;
      const becameVisible = visible && !isVisible;
      isVisible = visible;
      if (becameVisible && !state.isLoadingVisitors) {
        void refreshVisitors();
      }
    },
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    const messages = getTranslations().admin.error;
    if (error.code === "loadUsers" || error.code === "loadEvents" || error.code === "deleteUser") {
      return messages[error.code];
    }
    return getTranslations().admin.authError;
  }
  return error instanceof Error ? error.message : getTranslations().admin.unknownError;
}

function shortId(value: string): string {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function injectAdminStyles(): void {
  if (document.getElementById("admin-page-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "admin-page-styles";
  style.textContent = `
    .admin-page {
      height: 100dvh;
      min-height: 100dvh;
      background: #f6f8fb;
      color: #142033;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: auto;
    }

    .admin-shell {
      width: min(1440px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }

    .admin-header,
    .admin-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .admin-header {
      margin-bottom: 20px;
    }

    .admin-eyebrow {
      margin: 0 0 4px;
      color: #53657d;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .admin-header h1,
    .admin-section-header h2 {
      margin: 0;
      color: #142033;
      letter-spacing: 0;
    }

    .admin-header h1 {
      font-size: clamp(1.75rem, 4vw, 2.4rem);
      line-height: 1.1;
    }

    .admin-section-header {
      margin-bottom: 12px;
    }

    .admin-section-header h2 {
      font-size: 1rem;
    }

    .admin-section-header span {
      color: #607189;
      font-size: 0.9rem;
      font-weight: 700;
    }

    .admin-button {
      min-height: 40px;
      border: 1px solid #b8c4d4;
      border-radius: 8px;
      background: #ffffff;
      color: #142033;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      padding: 0 16px;
    }

    .admin-button:disabled {
      cursor: wait;
      opacity: 0.65;
    }

    .admin-button-danger {
      border-color: #e0a3a3;
      background: #fff5f5;
      color: #a31f1f;
    }

    .admin-button-danger:hover:enabled {
      background: #ffe7e7;
    }

    .admin-banner {
      margin-bottom: 16px;
      border: 1px solid #f0b7b7;
      border-radius: 8px;
      background: #fff1f1;
      color: #9f1d1d;
      padding: 12px 14px;
    }

    .admin-grid {
      display: grid;
      gap: 18px;
    }

    .admin-panel {
      min-width: 0;
      border: 1px solid #d8e0ea;
      border-radius: 8px;
      background: #ffffff;
      padding: 16px;
      box-shadow: 0 12px 28px rgb(27 45 70 / 8%);
    }

    .admin-table-wrap {
      overflow: auto;
    }

    .admin-events-wrap {
      max-height: min(70dvh, 760px);
    }

    .admin-table {
      width: 100%;
      min-width: 860px;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .admin-events-table {
      min-width: 680px;
    }

    .admin-table th,
    .admin-table td {
      border-bottom: 1px solid #e4eaf2;
      padding: 11px 10px;
      text-align: left;
      vertical-align: top;
    }

    .admin-table th {
      color: #53657d;
      font-size: 0.75rem;
      letter-spacing: 0;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .admin-table tbody tr[data-admin-visitor-id] {
      cursor: pointer;
    }

    .admin-table tbody tr[data-admin-visitor-id]:hover,
    .admin-table tbody tr.is-selected {
      background: #edf4ff;
    }

    .admin-table strong {
      display: block;
      color: #142033;
    }

    .admin-table-meta {
      display: block;
      max-width: 260px;
      margin-top: 3px;
      color: #607189;
      font-size: 0.78rem;
      overflow-wrap: anywhere;
    }

    .admin-identity-badge {
      display: inline-block;
      margin: 4px 6px 0 0;
      padding: 2px 7px;
      border-radius: 999px;
      background: #e5e7eb;
      color: #4b5563;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .admin-identity-badge.is-google { background: #dcfce7; color: #166534; }

    .admin-user-agent {
      max-width: 420px;
      overflow-wrap: anywhere;
    }

    .admin-table pre {
      max-width: 620px;
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font: 0.78rem/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }

    .admin-empty {
      color: #607189;
      text-align: center;
    }

    .admin-auth { width: min(440px, calc(100% - 32px)); margin: 12dvh auto; border: 1px solid #d8e0ea; border-radius: 12px; background: #fff; padding: 28px; box-shadow: 0 18px 40px rgb(27 45 70 / 12%); }
    .admin-auth h1 { margin: 0 0 12px; }
    .admin-auth [data-admin-google] { min-height: 44px; margin: 22px 0; }
    .admin-nav { display: flex; gap: 10px; margin-bottom: 18px; }
    .admin-nav .is-active, .admin-primary { border-color: #2563eb; background: #2563eb; color: #fff; }
    .admin-success { margin-bottom: 16px; border: 1px solid #86d6a6; border-radius: 8px; background: #effcf3; color: #166534; padding: 12px 14px; }
    .admin-settings-panel, .admin-history-panel { margin-bottom: 18px; }
    .admin-settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .admin-profile { min-width: 0; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; }
    .admin-profile legend { font-weight: 800; padding: 0 6px; }
    .admin-setting { display: grid; grid-template-columns: minmax(140px, 1fr) 44px; align-items: center; gap: 6px 10px; margin: 12px 0; }
    .admin-setting output { text-align: right; font-weight: 800; }
    .admin-setting input { grid-column: 1 / -1; width: 100%; }
    .admin-settings-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
    .admin-history-list { display: grid; gap: 8px; margin-bottom: 12px; }
    .admin-history-item { border: 1px solid #d8e0ea; border-radius: 8px; padding: 10px 12px; }
    .admin-history-item summary { cursor: pointer; display: flex; justify-content: space-between; gap: 12px; }
    .admin-history-item pre { max-height: 320px; overflow: auto; background: #f6f8fb; padding: 10px; }

    @media (max-width: 720px) {
      .admin-shell {
        width: min(100% - 20px, 1440px);
        padding-top: 18px;
      }

      .admin-header {
        align-items: flex-start;
        flex-direction: column;
      }

      .admin-button {
        width: 100%;
      }

      .admin-panel {
        padding: 12px;
      }
      .admin-settings-grid { grid-template-columns: 1fr; }
      .admin-settings-actions, .admin-nav, .admin-history-item summary { align-items: stretch; flex-direction: column; }
    }
  `;
  document.head.append(style);
}
