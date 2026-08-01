import {
  ensureCurrentPlayerIdentity,
  submitLeaderboardScore,
} from "./leaderboard-api.ts";
import { identityService } from "../auth/identity-service.ts";

export const MAX_BEST_SCORE = 1_000_000;
export const BEST_SCORE_STORAGE_KEY = "shapes-game.bestScore";
export const SYNCED_BEST_SCORE_STORAGE_KEY = "shapes-game.leaderboardSyncedBestScore";
const LEGACY_BEST_SCORE_MIGRATED_KEY = "shapes-game.bestScoreScopedMigration";

type BestScoreListener = (bestScore: number | null) => void;

let activeSync: Promise<number | null> | null = null;
let syncRequested = false;
const listeners = new Set<BestScoreListener>();

function parseBestScore(rawValue: string | null): number | null {
  if (rawValue === null || rawValue.trim() === "") return null;
  const value = Number(rawValue);
  return Number.isInteger(value) && value >= 0 && value <= MAX_BEST_SCORE ? value : null;
}

function writeScore(key: string, score: number): void {
  window.localStorage.setItem(key, String(score));
  if (key.startsWith(`${BEST_SCORE_STORAGE_KEY}.`) && !identityService.user) {
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(score));
  }
}

function scopedKey(baseKey: string): string {
  return `${baseKey}.${identityService.scoreScope}`;
}

function migrateLegacyBestScore(): void {
  if (identityService.user) return;
  if (window.localStorage.getItem(LEGACY_BEST_SCORE_MIGRATED_KEY) === "true") return;
  const key = scopedKey(BEST_SCORE_STORAGE_KEY);
  if (window.localStorage.getItem(key) === null) {
    const legacy = parseBestScore(window.localStorage.getItem(BEST_SCORE_STORAGE_KEY));
    if (legacy !== null) writeScore(key, legacy);
  }
  window.localStorage.setItem(LEGACY_BEST_SCORE_MIGRATED_KEY, "true");
}

function saveConfirmedServerBestScore(score: number): void {
  const confirmedBest = parseBestScore(
    window.localStorage.getItem(scopedKey(SYNCED_BEST_SCORE_STORAGE_KEY)),
  );
  writeScore(scopedKey(SYNCED_BEST_SCORE_STORAGE_KEY), Math.max(confirmedBest ?? 0, score));
}

function publish(bestScore: number | null): void {
  for (const listener of listeners) listener(bestScore);
}

export function readLocalBestScore(): number | null {
  if (typeof window === "undefined") return null;
  migrateLegacyBestScore();
  return parseBestScore(window.localStorage.getItem(scopedKey(BEST_SCORE_STORAGE_KEY)));
}

export function saveLocalBestScore(score: number): boolean {
  if (!Number.isInteger(score) || score < 0 || score > MAX_BEST_SCORE) return false;
  const current = readLocalBestScore();
  if (current !== null && score <= current) return false;
  writeScore(scopedKey(BEST_SCORE_STORAGE_KEY), score);
  publish(score);
  return true;
}

export function subscribeToBestScore(listener: BestScoreListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function performSync(): Promise<number | null> {
  let resolvedBest = readLocalBestScore();

  do {
    syncRequested = false;
    const player = await ensureCurrentPlayerIdentity();
    if (!player || player.bestScore < 0 || player.bestScore > MAX_BEST_SCORE) continue;

    const localBest = readLocalBestScore();
    let serverBest = player.bestScore;
    if (localBest !== null && localBest > serverBest) {
      const confirmedBest = await submitLeaderboardScore(localBest);
      if (confirmedBest === null || confirmedBest < 0 || confirmedBest > MAX_BEST_SCORE) continue;
      serverBest = confirmedBest;
    }

    resolvedBest = Math.max(localBest ?? 0, serverBest);
    if (localBest === null || resolvedBest > localBest) {
      writeScore(scopedKey(BEST_SCORE_STORAGE_KEY), resolvedBest);
      publish(resolvedBest);
    }
    saveConfirmedServerBestScore(serverBest);
  } while (syncRequested);

  return resolvedBest;
}

export function syncBestScore(): Promise<number | null> {
  if (activeSync) {
    syncRequested = true;
    return activeSync;
  }

  activeSync = performSync().finally(() => {
    activeSync = null;
    if (syncRequested) void syncBestScore();
  });
  return activeSync;
}
