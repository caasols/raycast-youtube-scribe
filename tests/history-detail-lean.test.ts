import { describe, expect, it } from "vitest";
import { buildHistoryDetailViewModel } from "../src/lib/history-detail";
import type { HistoryEntry, TranscriptSegment } from "../src/types";

const segments: TranscriptSegment[] = [
  { text: "one two three four", start_ms: 0, duration_ms: 2000 },
  { text: "five six seven eight", start_ms: 2000, duration_ms: 2000 },
  { text: "nine ten", start_ms: 4000, duration_ms: 5000 },
];

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "a",
    fetchKey: "a::auto",
    createdAt: "2026-03-14T10:00:00.000Z",
    videoId: "abc123def45",
    url: "https://www.youtube.com/watch?v=abc123def45",
    title: "Video",
    segmentCount: 3,
    status: "finished",
    ...overrides,
  };
}

/**
 * Since schema v6 the history list renders from lean entries with no transcript
 * body, so these pills must come from the stored stats instead of the segments.
 */
describe("detail pills on a lean (unhydrated) entry", () => {
  it("renders identical pills whether or not the body is attached", () => {
    const hydrated = buildHistoryDetailViewModel(
      entry({ rawSegments: segments }),
      "text",
    );
    const lean = buildHistoryDetailViewModel(
      entry({ wordCount: 10, transcriptDurationMs: 9000 }),
      "text",
    );

    expect(lean.primaryPills).toEqual(hydrated.primaryPills);
    expect(lean.primaryPills).toContain("10 words");
    expect(lean.primaryPills).toContain("00:09");
    expect(lean.primaryPills).toContain("~1 min read");
  });

  it("prefers stored stats over recomputing from an attached body", () => {
    const model = buildHistoryDetailViewModel(
      entry({ rawSegments: segments, wordCount: 999, transcriptDurationMs: 61000 }),
      "text",
    );

    expect(model.primaryPills).toContain("999 words");
    expect(model.primaryPills).toContain("01:01");
  });

  it("falls back to video metadata duration when no transcript stats exist", () => {
    const model = buildHistoryDetailViewModel(
      entry({ status: "error", videoMetadata: { durationText: "12:34" } }),
      "text",
    );

    expect(model.primaryPills).toContain("12:34");
    expect(model.primaryPills.some((p) => p.endsWith("words"))).toBe(false);
  });

  it("omits word count for entries that never finished", () => {
    const model = buildHistoryDetailViewModel(
      entry({ status: "fetching", wordCount: 50 }),
      "text",
    );

    expect(model.primaryPills.some((p) => p.endsWith("words"))).toBe(false);
  });
});
