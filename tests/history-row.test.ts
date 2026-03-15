import { describe, expect, it } from "vitest";

import { buildHistoryRowPresentation } from "../src/lib/history-row";
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

describe("buildHistoryRowPresentation", () => {
  it("keeps the left pane title-only without redundant subtitle metadata", () => {
    expect(buildHistoryRowPresentation(baseEntry)).toEqual({
      title: "Video",
      subtitle: undefined,
      icon: undefined,
    });
  });
});
