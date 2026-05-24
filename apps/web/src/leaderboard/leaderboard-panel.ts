import {
  formatPlayerPublicName,
  getPlayerPublicAccent,
} from "../player-public-identity/player-public-identity.ts";
import {
  fetchLeaderboard,
  isLeaderboardApiConfigured,
  type LeaderboardEntry,
} from "./leaderboard-api.ts";

export type LeaderboardPanel = ReturnType<typeof createLeaderboardPanel>;

export function createLeaderboardPanel() {
  const root = document.createElement("div");
  root.className = "leaderboard-overlay";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");

  const panel = document.createElement("section");
  panel.className = "leaderboard-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "leaderboard-title");

  const header = document.createElement("div");
  header.className = "leaderboard-header";

  const title = document.createElement("h2");
  title.id = "leaderboard-title";
  title.textContent = "Топ игроков";

  const closeButton = document.createElement("button");
  closeButton.className = "leaderboard-close";
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Закрыть таблицу лидеров");

  const status = document.createElement("p");
  status.className = "leaderboard-status";
  status.setAttribute("aria-live", "polite");

  const list = document.createElement("div");
  list.className = "leaderboard-list";

  header.append(title, closeButton);
  panel.append(header, status, list);
  root.append(panel);

  function close(): void {
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.classList.remove("is-visible");
  }

  function setLoading(): void {
    status.textContent = "Загрузка...";
    list.replaceChildren();
  }

  function setUnavailable(): void {
    status.textContent = isLeaderboardApiConfigured()
      ? "Не удалось загрузить топ игроков."
      : "Топ игроков будет доступен после подключения API.";
    list.replaceChildren();
  }

  function renderEntries(entries: LeaderboardEntry[], currentRank: number | null): void {
    list.replaceChildren();

    if (entries.length === 0) {
      status.textContent = currentRank === null
        ? "Пока нет результатов. Заверши раунд, чтобы попасть в топ."
        : "Пока нет соседних результатов.";
      return;
    }

    status.textContent = currentRank === null
      ? "Лучшие результаты"
      : `Твоя позиция: #${currentRank}`;

    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = "leaderboard-row";
      row.dataset.current = entry.isCurrentUser ? "true" : "false";
      row.style.setProperty("--player-accent", getPlayerPublicAccent(entry.publicColorId));

      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = `#${entry.rank}`;

      const marker = document.createElement("span");
      marker.className = "leaderboard-marker";
      marker.setAttribute("aria-hidden", "true");

      const name = document.createElement("span");
      name.className = "leaderboard-name";
      name.textContent = entry.isCurrentUser
        ? `You · ${formatPlayerPublicName({
          publicColorId: entry.publicColorId,
          publicNameId: entry.publicNameId,
        })}`
        : formatPlayerPublicName({
          publicColorId: entry.publicColorId,
          publicNameId: entry.publicNameId,
        });

      const score = document.createElement("strong");
      score.className = "leaderboard-score";
      score.textContent = entry.score.toLocaleString("ru-RU");

      row.append(rank, marker, name, score);
      list.append(row);
    }
  }

  closeButton.addEventListener("click", close);
  root.addEventListener("click", (event) => {
    if (event.target === root) {
      close();
    }
  });

  return {
    element: root,
    close,
    async open(): Promise<void> {
      root.hidden = false;
      root.setAttribute("aria-hidden", "false");
      root.classList.add("is-visible");
      setLoading();

      try {
        const response = await fetchLeaderboard({ aroundCurrentUser: true, limit: 20 });
        renderEntries(response.entries, response.currentRank);
      } catch {
        setUnavailable();
      }
    },
  };
}
