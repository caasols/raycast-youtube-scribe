import { describe, expect, it } from "vitest";
import {
  findFocusedHistoryEntry,
  reconcileFocusedHistoryEntry,
  shouldConsumeHistoryFocusRequest,
} from "../src/lib/history-navigation";
import type { HistoryEntry } from "../src/types";

const finished: HistoryEntry = {
  id: "finished",
  fetchKey: "abc::auto",
  createdAt: "2026-03-15T10:00:00.000Z",
  videoId: "abc",
  url: "https://www.youtube.com/watch?v=abc",
  title: "Video",
  format: "text",
  segmentCount: 1,
  output: "hello",
  rawSegments: [{ text: "hello", start_ms: 0, duration_ms: 1000 }],
  status: "finished",
};

describe("findFocusedHistoryEntry", () => {
  it("returns the requested finished entry", () => {
    expect(findFocusedHistoryEntry([finished], "finished")).toEqual(finished);
  });

  it("ignores missing and non-finished entries", () => {
    expect(findFocusedHistoryEntry([finished], "missing")).toBeUndefined();
    expect(
      findFocusedHistoryEntry([{ ...finished, id: "error", status: "error" }], "error"),
    ).toBeUndefined();
  });

  it("only consumes a focus request when the requested entry changes", () => {
    expect(shouldConsumeHistoryFocusRequest("finished", undefined)).toBe(true);
    expect(shouldConsumeHistoryFocusRequest("finished", finished)).toBe(false);
    expect(shouldConsumeHistoryFocusRequest("other", finished)).toBe(true);
    expect(shouldConsumeHistoryFocusRequest(undefined, finished)).toBe(false);
  });

  it("preserves the current focused entry when no new request exists", () => {
    expect(
      reconcileFocusedHistoryEntry([finished], undefined, finished),
    ).toEqual(finished);
  });
});
