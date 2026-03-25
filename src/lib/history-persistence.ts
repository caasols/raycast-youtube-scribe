import { repairStaleFetchingEntries } from "./history-logic";
import { classifyTranscriptError } from "./error-classification";
import { makeFetchKey } from "./youtube";
import type { HistoryEntry } from "../types";

export const HISTORY_SCHEMA_VERSION = 5;
export const DEFAULT_HISTORY_ENTRY_LIMIT = 100;

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

function pruneHistory(
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
  const { format: _, output: legacyOutput, ...rest } = entry as HistoryEntry & {
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

export function serializeHistory(
  entries: HistoryEntry[],
  policy?: RetentionPolicy,
): string {
  const payload: HistoryStoreEnvelope = {
    version: HISTORY_SCHEMA_VERSION,
    entries: pruneHistory(
      entries.map((e) => normalizeEntry(e, policy?.aiChatMaxAgeDays)),
      policy,
    ),
  };

  return JSON.stringify(payload);
}

export function deserializeHistory(
  raw?: string | null,
  policy?: RetentionPolicy,
): {
  entries: HistoryEntry[];
  serialized: string;
  didMigrate: boolean;
} {
  if (!raw) {
    return {
      entries: [],
      serialized: serializeHistory([], policy),
      didMigrate: false,
    };
  }

  try {
    const parsed = JSON.parse(raw) as HistoryStoreEnvelope | HistoryEntry[];
    const rawEntries = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.entries)
        ? parsed.entries
        : [];

    const normalized = repairStaleFetchingEntries(
      rawEntries.map((entry) => normalizeEntry(entry, policy?.aiChatMaxAgeDays)),
    );
    const pruned = pruneHistory(normalized, policy);
    const serialized = serializeHistory(pruned, policy);
    const didMigrate = raw !== serialized;

    return {
      entries: pruned,
      serialized,
      didMigrate,
    };
  } catch {
    return {
      entries: [],
      serialized: serializeHistory([], policy),
      didMigrate: false,
    };
  }
}
