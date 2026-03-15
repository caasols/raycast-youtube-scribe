import { describe, expect, it } from "vitest";
import { buildHistoryDetailMarkdown } from "../src/lib/history-detail";
import type { HistoryEntry } from "../src/types";

const baseEntry: HistoryEntry = {
  id: "1",
  fetchKey: "abc::auto",
  createdAt: "2026-03-14T10:00:00.000Z",
  videoId: "abc",
  url: "https://www.youtube.com/watch?v=abc",
  title: "Video",
  format: "text",
  segmentCount: 1,
  output: "hello world",
  rawSegments: [{ text: "hello world", start_ms: 0, duration_ms: 1000 }],
  status: "finished",
  debugLog: "debug info",
};

describe("buildHistoryDetailMarkdown", () => {
  it("does not append debug logs to finished transcript views", () => {
    const markdown = buildHistoryDetailMarkdown(baseEntry, "text");

    expect(markdown).toContain("## Transcript");
    expect(markdown).not.toContain("## Debug log");
    expect(markdown).toContain("hello world");
  });

  it("still shows debug logs for error entries", () => {
    const markdown = buildHistoryDetailMarkdown(
      {
        ...baseEntry,
        status: "error",
        output: "Failed to fetch transcript.",
        errorLog: "failed",
      },
      "text",
    );

    expect(markdown).toContain("## Error log");
    expect(markdown).toContain("## Debug log");
  });
});
