import { describe, expect, it } from "vitest";

describe("history persistence", () => {
  it("migrates legacy array history into the current schema and canonicalizes finished output", async () => {
    const { deserializeHistory } =
      await import("../src/lib/history-persistence");

    const result = deserializeHistory(
      JSON.stringify([
        {
          id: "1",
          createdAt: "2026-03-14T10:00:00.000Z",
          videoId: "abc123def45",
          url: "https://www.youtube.com/watch?v=abc123def45",
          title: "Video",
          language: "en",
          segmentCount: 2,
          format: "json",
          output: '[{"text":"stale"}]',
          rawSegments: [
            { text: "hello", start_ms: 0, duration_ms: 1000 },
            { text: "world", start_ms: 1000, duration_ms: 1000 },
          ],
          status: "finished",
        },
      ]),
    );

    expect(result.didMigrate).toBe(true);
    expect(result.entries).toEqual([
      expect.objectContaining({
        id: "1",
        fetchKey: "abc123def45::en",
        statusMessage: undefined,
      }),
    ]);
    expect(result.serialized).toContain('"version":4');
    expect(result.serialized).not.toContain('"format":');
    expect(result.serialized).not.toContain('"output":');
  });

  it("reads the wrapped schema without rewriting when entries are already normalized", async () => {
    const { deserializeHistory } =
      await import("../src/lib/history-persistence");

    const result = deserializeHistory(
      JSON.stringify({
        version: 4,
        entries: [
          {
            id: "1",
            fetchKey: "abc123def45::auto",
            createdAt: "2026-03-14T10:00:00.000Z",
            videoId: "abc123def45",
            url: "https://www.youtube.com/watch?v=abc123def45",
            title: "Video",
            segmentCount: 1,
            rawSegments: [{ text: "hello", start_ms: 0, duration_ms: 1000 }],
            status: "finished",
          },
        ],
      }),
    );

    expect(result.didMigrate).toBe(false);
    expect(result.entries).toEqual([
      expect.objectContaining({
        id: "1",
        fetchKey: "abc123def45::auto",
        statusMessage: undefined,
      }),
    ]);
  });

  it("backfills errorKind when migrating v3 error entries to v4", async () => {
    const { deserializeHistory } =
      await import("../src/lib/history-persistence");

    const result = deserializeHistory(
      JSON.stringify({
        version: 3,
        entries: [
          {
            id: "err-1",
            fetchKey: "abc123def45::auto",
            createdAt: "2026-03-14T10:00:00.000Z",
            videoId: "abc123def45",
            url: "https://www.youtube.com/watch?v=abc123def45",
            title: "Video",
            segmentCount: 0,
            status: "error",
            statusMessage: "Failed to fetch transcript.",
            errorLog:
              "yt-dlp timed out while fetching captions. Please retry.",
          },
        ],
      }),
    );

    expect(result.didMigrate).toBe(true);
    expect(result.entries[0]?.errorKind).toBe("timeout");
    expect(result.serialized).toContain('"version":4');
  });

  it("retains at most 100 entries, sorted by recency regardless of status", async () => {
    const { deserializeHistory } =
      await import("../src/lib/history-persistence");

    // Fetching entries are NEWEST (April, future) — they must come first under pure recency
    // Dates are in the future so repairStaleFetchingEntries does not convert them to error
    const fetchingEntries = Array.from({ length: 20 }, (_, index) => ({
      id: `fetching-${index}`,
      fetchKey: `fetching-${index}::auto`,
      createdAt: `2026-04-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
      videoId: `fetching-${index}`,
      url: `https://www.youtube.com/watch?v=fetching-${index}`,
      title: `Fetching ${index}`,
      segmentCount: 0,
      status: "fetching",
      statusMessage: "Still fetching transcript...",
    }));
    // Error entries are in the MIDDLE (February)
    const errorEntries = Array.from({ length: 50 }, (_, index) => ({
      id: `error-${index}`,
      fetchKey: `error-${index}::auto`,
      createdAt: `2026-02-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
      videoId: `error-${index}`,
      url: `https://www.youtube.com/watch?v=error-${index}`,
      title: `Error ${index}`,
      segmentCount: 0,
      status: "error",
      statusMessage: "Failed to fetch transcript.",
    }));
    // Finished entries are OLDEST (January) — old sort would promote these
    const finishedEntries = Array.from({ length: 60 }, (_, index) => ({
      id: `finished-${index}`,
      fetchKey: `finished-${index}::auto`,
      createdAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
      videoId: `finished-${index}`,
      url: `https://www.youtube.com/watch?v=finished-${index}`,
      title: `Finished ${index}`,
      segmentCount: 1,
      rawSegments: [{ text: "hello", start_ms: 0, duration_ms: 1000 }],
      status: "finished",
    }));

    const result = deserializeHistory(
      JSON.stringify({
        version: 3,
        entries: [...finishedEntries, ...errorEntries, ...fetchingEntries],
      }),
    );

    expect(result.entries).toHaveLength(100);
    // Under pure recency: all 20 fetching (April) + all 50 error (Feb) + 30 of 60 finished (Jan)
    expect(result.entries.filter((entry) => entry.status === "fetching")).toHaveLength(20);
    expect(result.entries.filter((entry) => entry.status === "error")).toHaveLength(50);
    expect(result.entries.filter((entry) => entry.status === "finished")).toHaveLength(30);
    // Newest first
    expect(result.entries[0]?.status).toBe("fetching");
    expect(result.entries.at(-1)?.status).toBe("finished");
  });
});
