import { describe, expect, it } from "vitest";
import { getFetchCompletionDestination } from "../src/lib/fetch-navigation";
import type { HistoryEntry } from "../src/types";

const baseEntry: HistoryEntry = {
  id: "entry-1",
  fetchKey: "abc::auto",
  createdAt: "2026-03-15T10:00:00.000Z",
  videoId: "abc",
  url: "https://www.youtube.com/watch?v=abc",
  title: "Video",
  segmentCount: 12,
  rawSegments: [{ text: "hello world", start_ms: 0, duration_ms: 1000 }],
  status: "finished",
};

describe("getFetchCompletionDestination", () => {
  it("opens the transcript detail for finished entries", () => {
    expect(getFetchCompletionDestination(baseEntry)).toBe("detail");
  });

  it("keeps non-finished entries on history", () => {
    expect(
      getFetchCompletionDestination({
        ...baseEntry,
        id: "fetching",
        status: "fetching",
        statusMessage: "Still fetching transcript...",
      }),
    ).toBe("history");

    expect(
      getFetchCompletionDestination({
        ...baseEntry,
        id: "error",
        status: "error",
        statusMessage: "Failed to fetch transcript.",
      }),
    ).toBe("history");
  });
});
