import { LocalStorage } from "@raycast/api";
import { HistoryEntry, TranscriptSegment } from "./types";
import {
  HISTORY_SCHEMA_VERSION,
  computeTranscriptStats,
  deserializeHistory,
  prepareHistoryForWrite,
  serializeHistory,
  stripSegments,
} from "./lib/history-persistence";
import type { RetentionPolicy } from "./lib/history-persistence";
import {
  getAiChatMaxAgeDays,
  getHistoryLimit,
  getHistoryMaxAgeDays,
} from "./lib/preferences";

export const HISTORY_KEY = "youtube-transcript-history";

/**
 * Transcript bodies live one-per-key outside the index. Reading the history list
 * therefore costs the size of the index, not the size of every transcript ever
 * fetched — which is what previously exhausted Raycast's 100 MB heap.
 */
export const SEGMENTS_KEY_PREFIX = "youtube-transcript-segments::";

export function segmentsKey(entryId: string): string {
  return `${SEGMENTS_KEY_PREFIX}${entryId}`;
}

function getRetentionPolicy(): RetentionPolicy {
  return {
    maxEntries: getHistoryLimit(),
    maxAgeDays: getHistoryMaxAgeDays(),
    aiChatMaxAgeDays: getAiChatMaxAgeDays(),
  };
}

// --- transcript bodies -------------------------------------------------------

export async function loadSegments(
  entryId: string,
): Promise<TranscriptSegment[] | undefined> {
  const raw = await LocalStorage.getItem<string>(segmentsKey(entryId));
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as TranscriptSegment[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function saveSegments(
  entryId: string,
  segments: TranscriptSegment[] | undefined,
): Promise<void> {
  if (!segments?.length) return;
  await LocalStorage.setItem(segmentsKey(entryId), JSON.stringify(segments));
}

export async function removeSegments(entryId: string): Promise<void> {
  await LocalStorage.removeItem(segmentsKey(entryId));
}

/** Reattach an entry's transcript body. */
export async function hydrateEntry(entry: HistoryEntry): Promise<HistoryEntry> {
  if (entry.rawSegments?.length) return entry;

  const rawSegments = await loadSegments(entry.id);
  return rawSegments ? { ...entry, rawSegments } : entry;
}

export async function loadHydratedEntry(
  entryId: string,
): Promise<HistoryEntry | undefined> {
  const entries = await loadHistory();
  const found = entries.find((e) => e.id === entryId);
  return found ? hydrateEntry(found) : undefined;
}

// --- index -------------------------------------------------------------------

/**
 * Move transcript bodies out of a pre-v6 index.
 *
 * Ordering matters: every body is written first, and the lean index is written
 * last as a single item. An interrupted run therefore leaves the old index
 * intact and simply retries on the next launch. Bodies are keyed by entry id and
 * never mutated, so rewriting them is harmless.
 */
async function migrateToSplitStorage(
  entries: HistoryEntry[],
  policy: RetentionPolicy,
): Promise<HistoryEntry[]> {
  const lean: HistoryEntry[] = [];

  for (const entry of entries) {
    if (entry.rawSegments?.length) {
      await saveSegments(entry.id, entry.rawSegments);
      const stats = computeTranscriptStats(entry.rawSegments);
      lean.push(stripSegments({ ...entry, ...stats }));
      // Release the body as we go so peak memory stays close to one transcript
      // rather than the whole corpus.
      delete entry.rawSegments;
    } else {
      lean.push(stripSegments(entry));
    }
  }

  const prepared = prepareHistoryForWrite(lean, policy);
  await LocalStorage.setItem(HISTORY_KEY, serializeHistory(prepared, policy));
  return prepared;
}

/**
 * Read the history index. Entries are lean: use `hydrateEntry` when you need the
 * transcript body. The only write that can happen here is completing a schema
 * migration, which is one-shot.
 */
export async function loadHistory(): Promise<HistoryEntry[]> {
  const raw = await LocalStorage.getItem<string>(HISTORY_KEY);
  if (!raw) return [];

  const policy = getRetentionPolicy();
  const { entries, version } = deserializeHistory(raw, policy);

  if (version < HISTORY_SCHEMA_VERSION) {
    return migrateToSplitStorage(entries, policy);
  }

  // Defensive: an index at the current version should never carry bodies.
  return entries.map(stripSegments);
}

/**
 * Every id currently in the index, deliberately unpruned.
 *
 * Pruning here would hide entries beyond the default cap, and those are exactly
 * the ones whose transcript bodies would then be stranded on clear or cleanup.
 */
async function currentEntryIds(): Promise<string[]> {
  const raw = await LocalStorage.getItem<string>(HISTORY_KEY);
  if (!raw) return [];

  const { entries } = deserializeHistory(raw, {
    maxEntries: Number.MAX_SAFE_INTEGER,
    maxAgeDays: null,
  });
  return entries.map((e) => e.id);
}

/**
 * Persist the index, splitting transcript bodies into their own keys and
 * deleting the bodies of any entry that no longer survives — removed by the user
 * or dropped by the retention policy — so bodies cannot outlive their entry.
 */
export async function saveHistory(
  entries: HistoryEntry[],
  policyOverride?: RetentionPolicy,
): Promise<HistoryEntry[]> {
  const policy = policyOverride ?? getRetentionPolicy();
  const previousIds = await currentEntryIds();

  for (const entry of entries) {
    await saveSegments(entry.id, entry.rawSegments);
  }

  const prepared = prepareHistoryForWrite(entries, policy);
  const survivingIds = new Set(prepared.map((e) => e.id));

  await LocalStorage.setItem(HISTORY_KEY, serializeHistory(prepared, policy));

  const dropped = new Set<string>(
    previousIds.filter((id) => !survivingIds.has(id)),
  );
  for (const entry of entries) {
    if (!survivingIds.has(entry.id)) dropped.add(entry.id);
  }
  for (const id of dropped) {
    await removeSegments(id);
  }

  return prepared;
}

export async function prependHistory(
  entry: HistoryEntry,
): Promise<HistoryEntry[]> {
  const current = await loadHistory();
  return saveHistory([entry, ...current.filter((e) => e.id !== entry.id)]);
}

export async function patchHistoryEntry(
  id: string,
  patch: Partial<HistoryEntry>,
): Promise<HistoryEntry[]> {
  const current = await loadHistory();
  const next = current.map((entry) =>
    entry.id === id ? { ...entry, ...patch } : entry,
  );
  return saveHistory(next);
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
  return saveHistory([patched, ...current.filter((entry) => entry.id !== id)]);
}

export async function removeHistoryEntry(id: string): Promise<HistoryEntry[]> {
  const current = await loadHistory();
  return saveHistory(current.filter((entry) => entry.id !== id));
}

export async function clearHistory(): Promise<void> {
  const ids = await currentEntryIds();
  for (const id of ids) {
    await removeSegments(id);
  }
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
  return saveHistory(cleared);
}
