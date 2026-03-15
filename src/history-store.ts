import { LocalStorage } from "@raycast/api";
import { HistoryEntry } from "./types";
import {
  deserializeHistory,
  serializeHistory,
} from "./lib/history-persistence";
import type { RetentionPolicy } from "./lib/history-persistence";
import { getHistoryLimit, getHistoryMaxAgeDays } from "./lib/preferences";

const HISTORY_KEY = "youtube-transcript-history";

function getRetentionPolicy(): RetentionPolicy {
  return {
    maxEntries: getHistoryLimit(),
    maxAgeDays: getHistoryMaxAgeDays(),
  };
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  const raw = await LocalStorage.getItem<string>(HISTORY_KEY);
  const policy = getRetentionPolicy();
  const result = deserializeHistory(raw, policy);

  // Note: we intentionally do NOT write back on migration here.
  // loadHistory() must be read-only to avoid race conditions between
  // the foreground command and the background worker. Any pending
  // migrations (stale entry repair, normalization, pruning) are applied
  // in memory and persisted on the next saveHistory() call.

  return result.entries;
}

export async function saveHistory(entries: HistoryEntry[]): Promise<void> {
  const policy = getRetentionPolicy();
  await LocalStorage.setItem(HISTORY_KEY, serializeHistory(entries, policy));
}

export async function prependHistory(
  entry: HistoryEntry,
): Promise<HistoryEntry[]> {
  const current = await loadHistory();
  const limit = getHistoryLimit();
  const next = [entry, ...current].slice(0, limit);
  await saveHistory(next);
  return next;
}

export async function patchHistoryEntry(
  id: string,
  patch: Partial<HistoryEntry>,
): Promise<HistoryEntry[]> {
  const current = await loadHistory();
  const next = current.map((entry) =>
    entry.id === id ? { ...entry, ...patch } : entry,
  );
  await saveHistory(next);
  return next;
}

export async function patchHistoryEntryAndMoveToFront(
  id: string,
  patch: Partial<HistoryEntry>,
): Promise<HistoryEntry[]> {
  const current = await loadHistory();
  const target = current.find((entry) => entry.id === id);
  if (!target) {
    return current;
  }

  const patched = { ...target, ...patch };
  const limit = getHistoryLimit();
  const next = [patched, ...current.filter((entry) => entry.id !== id)].slice(
    0,
    limit,
  );
  await saveHistory(next);
  return next;
}

export async function clearHistory(): Promise<void> {
  await LocalStorage.removeItem(HISTORY_KEY);
}

export async function clearBackgroundCompletedFlags(): Promise<HistoryEntry[]> {
  const entries = await loadHistory();
  const hasFlags = entries.some((entry) => entry.backgroundCompletedAt);
  if (!hasFlags) return entries;

  const cleared = entries.map((entry) =>
    entry.backgroundCompletedAt
      ? { ...entry, backgroundCompletedAt: undefined }
      : entry,
  );
  await saveHistory(cleared);
  return cleared;
}
