import { describe, expect, it } from "vitest";
import {
  buildJsonOutput,
  buildReadableTextOutput,
  buildTextOutput,
  materializeDisplayOutput,
  materializeOutput,
} from "../src/lib/output";
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
  segmentCount: 2,
  statusMessage: "placeholder",
  rawSegments,
  status: "finished",
};

describe("output helpers", () => {
  it("materializes transcript text and json from raw segments", () => {
    expect(buildTextOutput(rawSegments)).toBe("hello world");
    expect(buildReadableTextOutput(rawSegments)).toBe("**00:00**\nhello world");
    expect(buildJsonOutput(rawSegments)).toContain('"text": "hello"');
    expect(materializeOutput(baseEntry, "text")).toBe("hello world");
    expect(materializeDisplayOutput(baseEntry, "text")).toBe(
      "**00:00**\nhello world",
    );
    expect(materializeOutput(baseEntry, "json")).toContain(
      '"duration_ms": 1000',
    );
  });

  it("falls back to status message when canonical transcript data is unavailable", () => {
    expect(
      materializeOutput({ ...baseEntry, rawSegments: undefined }, "text"),
    ).toBe("placeholder");
    expect(
      materializeDisplayOutput(
        { ...baseEntry, rawSegments: undefined },
        "text",
      ),
    ).toBe("placeholder");
  });

  it("groups segments into readable paragraphs with timestamps", () => {
    const groupedSegments: TranscriptSegment[] = [
      { text: "First sentence.", start_ms: 0, duration_ms: 1200 },
      {
        text: "Second sentence continues the same idea.",
        start_ms: 1300,
        duration_ms: 1300,
      },
      {
        text: "A new paragraph starts after a pause.",
        start_ms: 4200,
        duration_ms: 1200,
      },
      { text: "And it keeps going.", start_ms: 5400, duration_ms: 1000 },
    ];

    expect(buildReadableTextOutput(groupedSegments)).toBe(
      "**00:00**\nFirst sentence. Second sentence continues the same idea.\n\n**00:04**\nA new paragraph starts after a pause. And it keeps going.",
    );
  });
});
