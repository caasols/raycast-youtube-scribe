import { describe, expect, it } from "vitest";
import {
  FINDING_STALE_AFTER_MS,
  findReusableEntry,
  matchesHistoryQuery,
  repairStaleFetchingEntries,
  shouldCopyEntryOutput,
} from "../src/lib/history-logic";
import type { HistoryEntry } from "../src/types";

const finished: HistoryEntry = {
  id: "finished",
  fetchKey: "abc::en",
  createdAt: "2026-03-14T10:00:00.000Z",
  videoId: "abc",
  url: "https://www.youtube.com/watch?v=abc",
  title: "Video",
  language: "en",
  format: "text",
  segmentCount: 2,
  output: "hello world",
  status: "finished",
};

describe("history logic", () => {
  it("reuses only finished entries with the same fetch key", () => {
    const errorEntry: HistoryEntry = {
      ...finished,
      id: "error",
      status: "error",
      output: "Failed to fetch transcript.",
    };
    const fetchingEntry: HistoryEntry = {
      ...finished,
      id: "fetching",
      status: "fetching",
      output: "Still fetching transcript...",
      createdAt: new Date().toISOString(),
    };
    const differentLang: HistoryEntry = {
      ...finished,
      id: "pt",
      fetchKey: "abc::pt",
      language: "pt",
    };

    expect(
      findReusableEntry(
        [errorEntry, fetchingEntry, differentLang, finished],
        "abc::en",
      ),
    ).toEqual({
      reusable: finished,
      inFlight: fetchingEntry,
      retryable: errorEntry,
    });
  });

  it("returns the latest failed entry as retryable for the same fetch key", () => {
    const olderError: HistoryEntry = {
      ...finished,
      id: "older-error",
      status: "error",
      output: "Failed to fetch transcript.",
      createdAt: "2026-03-14T09:00:00.000Z",
    };
    const newerError: HistoryEntry = {
      ...finished,
      id: "newer-error",
      status: "error",
      output: "Failed to fetch transcript.",
      createdAt: "2026-03-14T11:00:00.000Z",
    };

    expect(findReusableEntry([olderError, newerError], "abc::en")).toEqual({
      retryable: newerError,
    });
  });

  it("keeps auto-language retries separate from explicit language entries", () => {
    const autoError: HistoryEntry = {
      ...finished,
      id: "auto-error",
      fetchKey: "abc::auto",
      language: undefined,
      status: "error",
      output: "Failed to fetch transcript.",
    };

    expect(findReusableEntry([autoError], "abc::auto")).toEqual({
      retryable: autoError,
    });
    expect(findReusableEntry([autoError], "abc::en")).toEqual({});
  });

  it("only copies finished transcript output", () => {
    expect(shouldCopyEntryOutput(finished)).toBe(true);
    expect(shouldCopyEntryOutput({ ...finished, status: "fetching" })).toBe(
      false,
    );
    expect(shouldCopyEntryOutput({ ...finished, status: "error" })).toBe(false);
  });

  it("does not treat stale fetching entries as active in-flight jobs", () => {
    const staleFetching: HistoryEntry = {
      ...finished,
      id: "stale-fetching",
      status: "fetching",
      output: "Still fetching transcript...",
      createdAt: new Date(
        Date.now() - FINDING_STALE_AFTER_MS - 1_000,
      ).toISOString(),
    };

    expect(findReusableEntry([staleFetching], "abc::en")).toEqual({});
  });

  it("repairs stale fetching entries into errors", () => {
    const staleFetching: HistoryEntry = {
      ...finished,
      id: "stale-fetching",
      status: "fetching",
      output: "Still fetching transcript...",
      createdAt: new Date(
        Date.now() - FINDING_STALE_AFTER_MS - 1_000,
      ).toISOString(),
    };

    const repaired = repairStaleFetchingEntries([staleFetching]);
    expect(repaired[0]).toMatchObject({
      status: "error",
      output: "Failed to fetch transcript.",
    });
    expect(repaired[0].errorLog).toContain("timed out");
  });

  it("matches history queries against title and video id", () => {
    expect(matchesHistoryQuery(finished, "Video")).toBe(true);
    expect(matchesHistoryQuery(finished, "abc")).toBe(true);
    expect(matchesHistoryQuery(finished, "zzz")).toBe(false);
  });
});
