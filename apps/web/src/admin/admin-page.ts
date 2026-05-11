import { deleteVisitor, loadVisitorEvents, loadVisitors, type EventRecord, type VisitorRecord } from "./admin-api.ts";

type AdminState = {
  visitors: VisitorRecord[];
  selectedVisitorId: string | null;
  events: EventRecord[];
  isLoadingVisitors: boolean;
  isLoadingEvents: boolean;
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
  isLoadingVisitors: false,
  isLoadingEvents: false,
  deletingVisitorId: null,
  errorMessage: null,
  hasLoaded: false,
};

export function createAdminPage(): AdminPageController {
  injectAdminStyles();

  const root = document.createElement("div");
  root.className = "admin-page";
  root.hidden = true;

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
      return;
    }

    state.isLoadingEvents = true;
    state.errorMessage = null;
    render();

    try {
      state.events = await loadVisitorEvents(state.selectedVisitorId);
    } catch (error) {
      state.errorMessage = getErrorMessage(error);
      state.events = [];
    } finally {
      state.isLoadingEvents = false;
      render();
    }
  }

  async function deleteSelectedVisitor(visitorId: string): Promise<void> {
    const visitor = state.visitors.find((item) => item.id === visitorId);
    const confirmed = window.confirm(
      `Удалить пользователя ${visitor ? shortId(visitor.id) : visitorId} и все его события?`,
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
    root.innerHTML = `
      <section class="admin-shell" aria-labelledby="admin-title">
        <header class="admin-header">
          <div>
            <p class="admin-eyebrow">Shapes Game</p>
            <h1 id="admin-title">Админка</h1>
          </div>
          <button class="admin-button" type="button" data-admin-refresh ${state.isLoadingVisitors ? "disabled" : ""}>
            ${state.isLoadingVisitors ? "Загрузка" : "Обновить"}
          </button>
        </header>

        ${state.errorMessage ? `<div class="admin-banner" role="alert">${escapeHtml(state.errorMessage)}</div>` : ""}

        <div class="admin-grid">
          <section class="admin-panel" aria-labelledby="admin-users-title">
            <div class="admin-section-header">
              <h2 id="admin-users-title">Пользователи</h2>
              <span>${state.visitors.length}</span>
            </div>
            <div class="admin-table-wrap">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>IP</th>
                    <th>User-Agent</th>
                    <th>События</th>
                    <th>Создан</th>
                    <th>Действия</th>
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
              <h2 id="admin-events-title">События</h2>
              <span>${state.events.length}</span>
            </div>
            <div class="admin-table-wrap">
              <table class="admin-table admin-events-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Тип</th>
                    <th>Время клиента</th>
                    <th>Payload</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderEventRows()}
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
  }

  function renderVisitorRows(): string {
    if (state.isLoadingVisitors && !state.hasLoaded) {
      return '<tr><td colspan="6" class="admin-empty">Загружаем пользователей...</td></tr>';
    }

    if (state.visitors.length === 0) {
      return '<tr><td colspan="6" class="admin-empty">Пользователей пока нет.</td></tr>';
    }

    return state.visitors
      .map(
        (visitor) => {
          const isDeleting = state.deletingVisitorId === visitor.id;

          return `
          <tr data-admin-visitor-id="${escapeHtml(visitor.id)}" class="${visitor.id === state.selectedVisitorId ? "is-selected" : ""}" tabindex="0">
            <td>
              <strong>${escapeHtml(shortId(visitor.id))}</strong>
              <span class="admin-table-meta">${escapeHtml(visitor.id)}</span>
            </td>
            <td>${escapeHtml(visitor.ip || "нет IP")}</td>
            <td class="admin-user-agent">${escapeHtml(visitor.user_agent || "нет user-agent")}</td>
            <td>${visitor.events_count}</td>
            <td>${escapeHtml(formatDateTime(visitor.created_at))}</td>
            <td>
              <button
                class="admin-button admin-button-danger"
                type="button"
                data-admin-delete-visitor="${escapeHtml(visitor.id)}"
                ${isDeleting ? "disabled" : ""}
              >
                ${isDeleting ? "Удаляем" : "Удалить"}
              </button>
            </td>
          </tr>
        `;
        },
      )
      .join("");
  }

  function renderEventRows(): string {
    if (!state.selectedVisitorId) {
      return '<tr><td colspan="4" class="admin-empty">Выберите пользователя.</td></tr>';
    }

    if (state.isLoadingEvents) {
      return '<tr><td colspan="4" class="admin-empty">Загружаем события...</td></tr>';
    }

    if (state.events.length === 0) {
      return '<tr><td colspan="4" class="admin-empty">У пользователя пока нет событий.</td></tr>';
    }

    return state.events
      .map(
        (event) => `
          <tr>
            <td>#${event.id}</td>
            <td><strong>${escapeHtml(event.type)}</strong></td>
            <td>${escapeHtml(formatDateTime(event.client_created_at))}</td>
            <td><pre>${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre></td>
          </tr>
        `,
      )
      .join("");
  }

  render();

  return {
    element: root,
    setVisible(visible) {
      root.hidden = !visible;
      if (visible && !state.hasLoaded && !state.isLoadingVisitors) {
        void refreshVisitors();
      }
    },
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
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
    }
  `;
  document.head.append(style);
}
