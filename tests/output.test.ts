import { describe, expect, it } from "vitest";
import { buildJsonOutput, buildTextOutput, materializeOutput } from "../src/lib/output";
import type { HistoryEntry, TranscriptSegment } from "../src/types";

const rawSegments: TranscriptSegment[] = [
  { text: "hello", start_ms: 0, duration_ms: 1000 },
  { text: "world", start_ms: 1000, duration_ms: 1000 },
];

const baseEntry: HistoryEntry = {
  id: "1",
  fetchKey: "abc::auto",
  createdAt: "2026-03-14T10:00:00.000Z",
  videoId: "abc",
  url: "https://www.youtube.com/watch?v=abc",
  title: "Example",
  format: "text",
  segmentCount: 2,
  output: "placeholder",
  rawSegments,
  status: "finished",
};

describe("output helpers", () => {
  it("materializes transcript text and json from raw segments", () => {
    expect(buildTextOutput(rawSegments)).toBe("hello world");
    expect(buildJsonOutput(rawSegments)).toContain('"text": "hello"');
    expect(materializeOutput(baseEntry, "text")).toBe("hello world");
    expect(materializeOutput(baseEntry, "json")).toContain('"duration_ms": 1000');
  });

  it("falls back to persisted output when raw segments are unavailable", () => {
    expect(materializeOutput({ ...baseEntry, rawSegments: undefined }, "text")).toBe("placeholder");
  });
});
