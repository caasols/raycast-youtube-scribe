import { HistoryEntry } from "../types";

export const HISTORY_FOCUS_ENTRY_KEY = "transcript-history-focus-entry-id";

export function findFocusedHistoryEntry(
  entries: HistoryEntry[],
  entryId?: string | null,
): HistoryEntry | undefined {
  if (!entryId) return undefined;

  const entry = entries.find((item) => item.id === entryId);
  if (!entry || entry.status !== "finished") {
    return undefined;
  }

  return entry;
}

export function shouldConsumeHistoryFocusRequest(
  requestedEntryId?: string | null,
  focusedEntry?: HistoryEntry,
): boolean {
  if (!requestedEntryId) return false;
  return focusedEntry?.id !== requestedEntryId;
}

export function reconcileFocusedHistoryEntry(
  entries: HistoryEntry[],
  requestedEntryId?: string | null,
  focusedEntry?: HistoryEntry,
): HistoryEntry | undefined {
  const requestedEntry = findFocusedHistoryEntry(entries, requestedEntryId);
  if (requestedEntry) {
    return requestedEntry;
  }

  if (!focusedEntry) {
    return undefined;
  }

  return (
    entries.find(
      (entry) => entry.id === focusedEntry.id && entry.status === "finished",
    ) ?? undefined
  );
}
