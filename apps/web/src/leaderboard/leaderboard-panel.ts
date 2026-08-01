import {
  formatPlayerPublicName,
  getPlayerPublicAccent,
} from "../player-public-identity/player-public-identity.ts";
import {
  fetchLeaderboard,
  isLeaderboardApiConfigured,
  type LeaderboardEntry,
} from "./leaderboard-api.ts";
import { syncBestScore } from "./best-score-sync.ts";
import { formatNumber, getTranslations, subscribeToLocaleChange } from "../localization/localization.ts";

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

  const closeButton = document.createElement("button");
  closeButton.className = "leaderboard-close";
  closeButton.type = "button";
  closeButton.textContent = "×";

  const status = document.createElement("p");
  status.className = "leaderboard-status";
  status.setAttribute("aria-live", "polite");

  const list = document.createElement("div");
  list.className = "leaderboard-list";

  header.append(title, closeButton);
  panel.append(header, status, list);
  root.append(panel);

  function renderStaticText(): void {
    const text = getTranslations();
    title.textContent = text.leaderboard.title;
    closeButton.setAttribute("aria-label", text.leaderboard.closeAria);
  }

  renderStaticText();
  subscribeToLocaleChange(renderStaticText);

  function close(): void {
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.classList.remove("is-visible");
  }

  function setLoading(): void {
    status.textContent = getTranslations().leaderboard.loading;
    list.replaceChildren();
  }

  function setUnavailable(): void {
    const text = getTranslations();
    status.textContent = isLeaderboardApiConfigured()
      ? text.leaderboard.loadFailed
      : text.leaderboard.notConfigured;
    list.replaceChildren();
  }

  function renderEntries(entries: LeaderboardEntry[], currentRank: number | null): void {
    const text = getTranslations();
    list.replaceChildren();

    if (entries.length === 0) {
      status.textContent = currentRank === null
        ? text.leaderboard.empty
        : text.leaderboard.noNeighbors;
      return;
    }

    status.textContent = currentRank === null
      ? text.leaderboard.bestResults
      : text.leaderboard.currentRank(currentRank);

    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = "leaderboard-row";
      row.dataset.current = entry.isCurrentUser ? "true" : "false";
      const authenticated = entry.identity?.type === "authenticated" ? entry.identity : null;
      row.style.setProperty("--player-accent", authenticated ? "#34a853" : getPlayerPublicAccent(entry.publicColorId));

      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = `#${entry.rank}`;

      const marker = document.createElement("span");
      marker.className = "leaderboard-marker";
      marker.setAttribute("aria-hidden", "true");
      if (authenticated) {
        marker.classList.add("leaderboard-avatar");
        const avatar = document.createElement("img");
        avatar.alt = "";
        avatar.referrerPolicy = "no-referrer";
        if (authenticated.avatarUrl) avatar.src = authenticated.avatarUrl;
        avatar.addEventListener("error", () => avatar.removeAttribute("src"));
        marker.append(avatar);
      }

      const name = document.createElement("span");
      name.className = "leaderboard-name";
      const publicName = authenticated?.displayName ?? formatPlayerPublicName({
        publicColorId: entry.publicColorId,
        publicNameId: entry.publicNameId,
      });
      name.textContent = entry.isCurrentUser
        ? `${text.leaderboard.you} · ${publicName}`
        : publicName;

      const score = document.createElement("strong");
      score.className = "leaderboard-score";
      score.textContent = formatNumber(entry.score);

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
        await syncBestScore();
        const response = await fetchLeaderboard({ aroundCurrentUser: false, limit: 20 });
        renderEntries(response.entries, response.currentRank);
      } catch {
        setUnavailable();
      }
    },
  };
}
