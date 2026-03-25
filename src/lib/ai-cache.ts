import type {
  HistoryEntry,
  CachedAiSummary,
  CachedAiAnswer,
} from "../types";
import { loadHistory, patchHistoryEntry } from "../history-store";

/**
 * Load the latest version of an entry from LocalStorage.
 * The `entry` prop passed via Action.Push is a stale snapshot —
 * this fetches the real current state so cached AI data is visible.
 */
export async function loadFreshEntry(
  entryId: string,
): Promise<HistoryEntry | undefined> {
  const entries = await loadHistory();
  return entries.find((e) => e.id === entryId);
}

export function findCachedSummary(
  entry: HistoryEntry,
): CachedAiSummary | undefined {
  return entry.aiSummaries?.[0];
}

export function findCachedAnswer(
  entry: HistoryEntry,
  question: string,
): CachedAiAnswer | undefined {
  const normalized = question.trim().toLowerCase();
  return entry.aiAnswers?.find(
    (a) => a.question.trim().toLowerCase() === normalized,
  );
}

export async function saveSummary(
  entryId: string,
  currentSummaries: CachedAiSummary[] | undefined,
  content: string,
  mode: "replace" | "append",
): Promise<void> {
  const now = new Date().toISOString();
  const existing = currentSummaries ?? [];

  const updated =
    mode === "replace"
      ? [{ content, createdAt: now }, ...existing.slice(1)]
      : [{ content, createdAt: now }, ...existing];

  await patchHistoryEntry(entryId, { aiSummaries: updated });
}

export async function deleteSummary(
  entryId: string,
  createdAt: string,
): Promise<void> {
  const entry = await loadFreshEntry(entryId);
  if (!entry) return;
  const filtered = (entry.aiSummaries ?? []).filter(
    (s) => s.createdAt !== createdAt,
  );
  await patchHistoryEntry(entryId, { aiSummaries: filtered });
}

export async function deleteAnswer(
  entryId: string,
  createdAt: string,
): Promise<void> {
  const entry = await loadFreshEntry(entryId);
  if (!entry) return;
  const filtered = (entry.aiAnswers ?? []).filter(
    (a) => a.createdAt !== createdAt,
  );
  await patchHistoryEntry(entryId, { aiAnswers: filtered });
}

export async function togglePin(
  entryId: string,
  kind: "summary" | "answer",
  createdAt: string,
): Promise<void> {
  const entry = await loadFreshEntry(entryId);
  if (!entry) return;

  if (kind === "summary") {
    const updated = (entry.aiSummaries ?? []).map((s) =>
      s.createdAt === createdAt ? { ...s, pinned: !s.pinned } : s,
    );
    await patchHistoryEntry(entryId, { aiSummaries: updated });
  } else {
    const updated = (entry.aiAnswers ?? []).map((a) =>
      a.createdAt === createdAt ? { ...a, pinned: !a.pinned } : a,
    );
    await patchHistoryEntry(entryId, { aiAnswers: updated });
  }
}

export async function clearAllAiChats(entryId: string): Promise<void> {
  await patchHistoryEntry(entryId, {
    aiSummaries: [],
    aiAnswers: [],
  });
}

export async function saveAnswer(
  entryId: string,
  currentAnswers: CachedAiAnswer[] | undefined,
  question: string,
  answer: string,
  mode: "replace" | "append",
  parentCreatedAt?: string,
): Promise<void> {
  const now = new Date().toISOString();
  const normalized = question.trim().toLowerCase();
  const existing = currentAnswers ?? [];
  const newEntry: CachedAiAnswer = {
    question,
    answer,
    createdAt: now,
    ...(parentCreatedAt ? { parentCreatedAt } : {}),
  };

  if (mode === "replace") {
    const idx = existing.findIndex(
      (a) => a.question.trim().toLowerCase() === normalized,
    );
    if (idx >= 0) {
      const updated = [...existing];
      updated[idx] = newEntry;
      await patchHistoryEntry(entryId, { aiAnswers: updated });
    } else {
      await patchHistoryEntry(entryId, {
        aiAnswers: [newEntry, ...existing],
      });
    }
  } else {
    await patchHistoryEntry(entryId, {
      aiAnswers: [newEntry, ...existing],
    });
  }
}
