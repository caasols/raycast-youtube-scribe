import { repairStaleFetchingEntries } from "./history-logic";
import { classifyTranscriptError } from "./error-classification";
import { countWords } from "./text-utils";
import { makeFetchKey } from "./youtube";
import type { HistoryEntry, TranscriptSegment } from "../types";

export const HISTORY_SCHEMA_VERSION = 6;
export const DEFAULT_HISTORY_ENTRY_LIMIT = 100;

export type TranscriptStats = {
  wordCount: number;
  transcriptDurationMs: number;
};

/**
 * Stats the history list needs but which can only be derived from the transcript
 * body. Computed once at write time so lean index rows still render duration,
 * word count, and reading time without loading any segments.
 */
export function computeTranscriptStats(
  segments: TranscriptSegment[] | undefined,
): TranscriptStats | undefined {
  if (!segments?.length) return undefined;

  const first = segments[0];
  const last = segments[segments.length - 1];

  return {
    wordCount: countWords(segments.map((s) => s.text).join(" ")),
    transcriptDurationMs: Math.max(
      0,
      last.start_ms + last.duration_ms - first.start_ms,
    ),
  };
}

/**
 * Drop the transcript body, backfilling any derived stats it still owes the
 * index. This is the boundary that keeps transcripts out of the index blob.
 */
export function stripSegments(entry: HistoryEntry): HistoryEntry {
  const stats =
    entry.wordCount === undefined || entry.transcriptDurationMs === undefined
      ? computeTranscriptStats(entry.rawSegments)
      : undefined;

  const lean: HistoryEntry = { ...entry, ...stats };
  delete lean.rawSegments;
  return lean;
}

export type RetentionPolicy = {
  maxEntries: number;
  maxAgeDays: number | null;
  aiChatMaxAgeDays?: number | null;
};

type HistoryStoreEnvelope = {
  version: number;
  entries: HistoryEntry[];
};

function entryTimestamp(entry: HistoryEntry): number {
  const timestamp = new Date(entry.createdAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function pruneHistory(
  entries: HistoryEntry[],
  policy: RetentionPolicy = {
    maxEntries: DEFAULT_HISTORY_ENTRY_LIMIT,
    maxAgeDays: null,
  },
): HistoryEntry[] {
  let result = [...entries].sort(
    (left, right) => entryTimestamp(right) - entryTimestamp(left),
  );

  if (policy.maxAgeDays !== null) {
    const cutoffMs = Date.now() - policy.maxAgeDays * 24 * 60 * 60 * 1000;
    result = result.filter((entry) => entryTimestamp(entry) >= cutoffMs);
  }

  return result.slice(0, policy.maxEntries);
}

function normalizeEntry(
  entry: HistoryEntry,
  aiChatMaxAgeDays?: number | null,
): HistoryEntry {
  // Legacy entries (pre-v3) may carry `format` and `output` fields that no
  // longer exist in the HistoryEntry type. Strip them via destructuring.
  const {
    format: _,
    output: legacyOutput,
    ...rest
  } = entry as HistoryEntry & {
    format?: string;
    output?: string;
  };

  const normalized: HistoryEntry = {
    ...rest,
    fetchKey: entry.fetchKey ?? makeFetchKey(entry.videoId, entry.language),
    statusMessage:
      entry.status === "finished"
        ? undefined
        : (entry.statusMessage ?? legacyOutput),
  };

  if (normalized.status === "finished" && normalized.rawSegments?.length) {
    normalized.statusMessage = undefined;
  } else if (
    normalized.status === "finished" &&
    !normalized.rawSegments?.length &&
    legacyOutput
  ) {
    normalized.statusMessage = legacyOutput;
  }

  // Drop legacy aiSummary field — it was shared by both "Summarize" and
  // "Ask AI", so we can't tell which produced it. Start fresh with the
  // new separated aiSummaries / aiAnswers fields.
  delete normalized.aiSummary;

  // Prune expired AI chats based on caller-provided retention setting.
  const aiMaxAge = aiChatMaxAgeDays ?? null;
  if (aiMaxAge !== null) {
    const cutoff = Date.now() - aiMaxAge * 24 * 60 * 60 * 1000;
    if (normalized.aiSummaries?.length) {
      normalized.aiSummaries = normalized.aiSummaries.filter(
        (s) => new Date(s.createdAt).getTime() >= cutoff,
      );
    }
    if (normalized.aiAnswers?.length) {
      normalized.aiAnswers = normalized.aiAnswers.filter(
        (a) => new Date(a.createdAt).getTime() >= cutoff,
      );
    }
  }

  if (normalized.status === "error" && !normalized.errorKind) {
    normalized.errorKind = classifyTranscriptError(
      normalized.errorLog ?? normalized.debugLog ?? "",
    );
  }

  return normalized;
}

/**
 * Normalize, prune, and strip transcript bodies. The returned entries are exactly
 * what gets persisted, so callers can diff their ids to find dropped bodies.
 */
export function prepareHistoryForWrite(
  entries: HistoryEntry[],
  policy?: RetentionPolicy,
): HistoryEntry[] {
  return pruneHistory(
    entries.map((e) =>
      stripSegments(normalizeEntry(e, policy?.aiChatMaxAgeDays)),
    ),
    policy,
  );
}

export function serializeHistory(
  entries: HistoryEntry[],
  policy?: RetentionPolicy,
): string {
  const payload: HistoryStoreEnvelope = {
    version: HISTORY_SCHEMA_VERSION,
    entries: prepareHistoryForWrite(entries, policy),
  };

  return JSON.stringify(payload);
}

/**
 * Read the index. Deliberately does no serialization work: an earlier version
 * re-serialized the whole store just to compute a `didMigrate` flag that the
 * caller threw away, which cost a full extra copy of every entry on every read
 * and was a major contributor to hitting Raycast's 100 MB heap limit.
 */
export function deserializeHistory(
  raw?: string | null,
  policy?: RetentionPolicy,
): {
  entries: HistoryEntry[];
  version: number;
} {
  if (!raw) {
    return { entries: [], version: HISTORY_SCHEMA_VERSION };
  }

  try {
    const parsed = JSON.parse(raw) as HistoryStoreEnvelope | HistoryEntry[];
    const isEnvelope = !Array.isArray(parsed);
    const rawEntries = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.entries)
        ? parsed.entries
        : [];
    // A bare array predates the version envelope entirely.
    const version = isEnvelope
      ? ((parsed as HistoryStoreEnvelope).version ?? 0)
      : 0;

    const normalized = repairStaleFetchingEntries(
      rawEntries.map((entry) =>
        normalizeEntry(entry, policy?.aiChatMaxAgeDays),
      ),
    );

    return { entries: pruneHistory(normalized, policy), version };
  } catch {
    return { entries: [], version: HISTORY_SCHEMA_VERSION };
  }
}
