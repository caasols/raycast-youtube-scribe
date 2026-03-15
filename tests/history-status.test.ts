import { describe, expect, it } from "vitest";

import { buildHistoryStatusPresentation } from "../src/lib/history-status";
import type { HistoryEntry } from "../src/types";

const baseEntry: HistoryEntry = {
  id: "1",
  fetchKey: "abc::auto",
  createdAt: "2026-03-14T10:00:00.000Z",
  videoId: "abc",
  url: "https://www.youtube.com/watch?v=abc",
  title: "Video",
  segmentCount: 1,
  rawSegments: [{ text: "hello world", start_ms: 0, duration_ms: 1000 }],
  status: "finished",
  debugLog: "debug info",
};

describe("buildHistoryStatusPresentation", () => {
  it("returns a tone and tooltip without a text label dependency", () => {
    expect(buildHistoryStatusPresentation(baseEntry)).toEqual({
      tone: "green",
      tooltip: "Transcript ready",
    });
  });

  it("returns an orange tone for fetching entries", () => {
    expect(
      buildHistoryStatusPresentation({
        ...baseEntry,
        status: "fetching",
      }),
    ).toEqual({
      tone: "orange",
      tooltip: "Fetching transcript",
    });
  });
});
