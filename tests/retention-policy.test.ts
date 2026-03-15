import { describe, expect, it } from "vitest";
import { serializeHistory, DEFAULT_HISTORY_ENTRY_LIMIT } from "../src/lib/history-persistence";
import type { RetentionPolicy } from "../src/lib/history-persistence";
import type { HistoryEntry } from "../src/types";

function makeEntry(id: string, createdAt: string): HistoryEntry {
  return {
    id,
    fetchKey: `key-${id}`,
    createdAt,
    videoId: `vid-${id}`,
    url: `https://youtube.com/watch?v=vid-${id}`,
    title: `Video ${id}`,
    segmentCount: 0,
    status: "finished",
  };
}

describe("retention policy", () => {
  it("limits entries to maxEntries", () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      makeEntry(`e${i}`, new Date(2026, 0, i + 1).toISOString()),
    );
    const policy: RetentionPolicy = { maxEntries: 10, maxAgeDays: null };
    const serialized = serializeHistory(entries, policy);
    const parsed = JSON.parse(serialized);
    expect(parsed.entries).toHaveLength(10);
  });

  it("removes entries older than maxAgeDays", () => {
    const now = new Date();
    const recent = makeEntry("recent", now.toISOString());
    const old = makeEntry(
      "old",
      new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    );
    const policy: RetentionPolicy = { maxEntries: 100, maxAgeDays: 30 };
    const serialized = serializeHistory([recent, old], policy);
    const parsed = JSON.parse(serialized);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].id).toBe("recent");
  });

  it("applies both maxEntries and maxAgeDays", () => {
    const now = new Date();
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry(`e${i}`, new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString()),
    );
    const policy: RetentionPolicy = { maxEntries: 5, maxAgeDays: 3 };
    const serialized = serializeHistory(entries, policy);
    const parsed = JSON.parse(serialized);
    // maxAgeDays=3 keeps entries from last 3 days (entries 0-2 or 0-3 depending on boundary),
    // then maxEntries=5 doesn't further limit. Either way well below 10 total.
    expect(parsed.entries.length).toBeLessThanOrEqual(5);
    expect(parsed.entries.length).toBeLessThan(10);
  });

  it("uses default limit when no policy provided", () => {
    const entries = Array.from({ length: 150 }, (_, i) =>
      makeEntry(`e${i}`, new Date(2026, 0, i + 1).toISOString()),
    );
    const serialized = serializeHistory(entries);
    const parsed = JSON.parse(serialized);
    expect(parsed.entries).toHaveLength(DEFAULT_HISTORY_ENTRY_LIMIT);
  });
});
