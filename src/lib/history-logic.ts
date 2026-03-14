import { HistoryEntry } from "../types";

export const FINDING_STALE_AFTER_MS = 90_000;

function isValidTimestamp(input: string): boolean {
  return !Number.isNaN(new Date(input).getTime());
}

function isStaleFetchingEntry(entry: HistoryEntry, now = Date.now()): boolean {
  if (entry.status !== "fetching") return false;
  if (!isValidTimestamp(entry.createdAt)) return true;

  return now - new Date(entry.createdAt).getTime() > FINDING_STALE_AFTER_MS;
}

export function findReusableEntry(
  entries: HistoryEntry[],
  fetchKey: string,
  now = Date.now(),
): {
  reusable?: HistoryEntry;
  inFlight?: HistoryEntry;
} {
  const matches = entries.filter((entry) => entry.fetchKey === fetchKey);

  return {
    reusable: matches.find((entry) => entry.status === "finished"),
    inFlight: matches.find(
      (entry) =>
        entry.status === "fetching" && !isStaleFetchingEntry(entry, now),
    ),
  };
}

export function repairStaleFetchingEntries(
  entries: HistoryEntry[],
  now = Date.now(),
): HistoryEntry[] {
  return entries.map((entry) => {
    if (!isStaleFetchingEntry(entry, now)) {
      return entry;
    }

    return {
      ...entry,
      status: "error",
      output: "Failed to fetch transcript.",
      errorLog:
        entry.errorLog ??
        "Transcript fetch timed out or Raycast closed before the job completed.",
    };
  });
}

export function shouldCopyEntryOutput(entry: HistoryEntry): boolean {
  return entry.status === "finished";
}

export function matchesHistoryQuery(
  entry: HistoryEntry,
  query: string,
): boolean {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return true;

  const haystacks = [
    entry.title || "",
    entry.videoId || "",
    entry.url || "",
  ].map((value) => value.toLowerCase());
  return haystacks.some((value) => value.includes(normalized));
}
