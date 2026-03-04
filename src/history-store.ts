import { LocalStorage } from "@raycast/api";
import { HistoryEntry } from "./types";

const HISTORY_KEY = "youtube-transcript-history";

export async function loadHistory(): Promise<HistoryEntry[]> {
  const raw = await LocalStorage.getItem<string>(HISTORY_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function saveHistory(entries: HistoryEntry[]): Promise<void> {
  await LocalStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export async function prependHistory(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const current = await loadHistory();
  const next = [entry, ...current].slice(0, 200);
  await saveHistory(next);
  return next;
}

export async function clearHistory(): Promise<void> {
  await LocalStorage.removeItem(HISTORY_KEY);
}
