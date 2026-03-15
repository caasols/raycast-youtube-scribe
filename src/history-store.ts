import { LocalStorage } from "@raycast/api";
import { HistoryEntry } from "./types";
import { repairStaleFetchingEntries } from "./lib/history-logic";
import { makeFetchKey } from "./lib/youtube";

const HISTORY_KEY = "youtube-transcript-history";

export async function loadHistory(): Promise<HistoryEntry[]> {
  const raw = await LocalStorage.getItem<string>(HISTORY_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map((entry) => ({
      ...entry,
      fetchKey: entry.fetchKey ?? makeFetchKey(entry.videoId, entry.language),
    }));
    const repaired = repairStaleFetchingEntries(normalized);
    if (JSON.stringify(repaired) !== JSON.stringify(normalized)) {
      await saveHistory(repaired);
    }
    return repaired;
  } catch {
    return [];
  }
}

export async function saveHistory(entries: HistoryEntry[]): Promise<void> {
  await LocalStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export async function prependHistory(
  entry: HistoryEntry,
): Promise<HistoryEntry[]> {
  const current = await loadHistory();
  const next = [entry, ...current].slice(0, 200);
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
  const next = [patched, ...current.filter((entry) => entry.id !== id)].slice(
    0,
    200,
  );
  await saveHistory(next);
  return next;
}

export async function clearHistory(): Promise<void> {
  await LocalStorage.removeItem(HISTORY_KEY);
}
