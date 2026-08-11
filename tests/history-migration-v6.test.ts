import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorage } from "@raycast/api";
// Helpers live on the vitest mock, which "@raycast/api" is aliased to at runtime.
import { __keys, __resetLocalStorage } from "./__mocks__/@raycast/api";
import {
  HISTORY_KEY,
  loadHistory,
  loadSegments,
  segmentsKey,
} from "../src/history-store";
import { HISTORY_SCHEMA_VERSION } from "../src/lib/history-persistence";
import type { HistoryEntry, TranscriptSegment } from "../src/types";

function segments(n: number): TranscriptSegment[] {
  return Array.from({ length: n }, (_, i) => ({
    text: `word${i} spoken here now`,
    start_ms: i * 2000,
    duration_ms: 2000,
  }));
}

/** A pre-split (v5) payload: transcript bodies inline in the index. */
function writeV5(count: number, segsPer = 4) {
  const entries: HistoryEntry[] = Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    fetchKey: `e${i}::auto`,
    createdAt: new Date(1700000000000 + i * 1000).toISOString(),
    videoId: `vid${i}`,
    url: `https://www.youtube.com/watch?v=vid${i}`,
    title: `Video ${i}`,
    segmentCount: segsPer,
    rawSegments: segments(segsPer),
    status: "finished",
  }));
  return LocalStorage.setItem(
    HISTORY_KEY,
    JSON.stringify({ version: 5, entries }),
  );
}

beforeEach(() => {
  __resetLocalStorage();
});

describe("v5 -> v6 migration", () => {
  it("moves transcript bodies into per-entry keys and leaves a lean index", async () => {
    await writeV5(3);

    const loaded = await loadHistory();

    expect(loaded).toHaveLength(3);
    expect(loaded.every((e) => e.rawSegments === undefined)).toBe(true);

    const raw = (await LocalStorage.getItem<string>(HISTORY_KEY)) ?? "";
    expect(raw).not.toContain("rawSegments");
    expect(JSON.parse(raw).version).toBe(HISTORY_SCHEMA_VERSION);

    for (const id of ["e0", "e1", "e2"]) {
      expect(await loadSegments(id)).toHaveLength(4);
    }
  });

  it("backfills wordCount and transcriptDurationMs so the list can render without bodies", async () => {
    await writeV5(1, 5);

    const [migrated] = await loadHistory();

    // 5 segments x 4 words each.
    expect(migrated.wordCount).toBe(20);
    // starts at 0, last starts at 8000 with duration 2000.
    expect(migrated.transcriptDurationMs).toBe(10000);
  });

  it("is idempotent — a second load changes nothing", async () => {
    await writeV5(2);

    await loadHistory();
    const afterFirst = (await LocalStorage.getItem<string>(HISTORY_KEY)) ?? "";
    const keysAfterFirst = __keys();

    await loadHistory();

    expect(await LocalStorage.getItem<string>(HISTORY_KEY)).toBe(afterFirst);
    expect(__keys()).toEqual(keysAfterFirst);
  });

  it("does not rewrite an index that is already v6", async () => {
    await writeV5(1);
    await loadHistory();

    const before = (await LocalStorage.getItem<string>(HISTORY_KEY)) ?? "";
    await LocalStorage.removeItem(segmentsKey("e0"));

    // Already-migrated index must not be re-derived from missing bodies.
    await loadHistory();
    expect(await LocalStorage.getItem<string>(HISTORY_KEY)).toBe(before);
  });

  it("recovers when interrupted after writing bodies but before the index", async () => {
    await writeV5(2);
    const v5Payload = (await LocalStorage.getItem<string>(HISTORY_KEY)) ?? "";

    // Simulate a crash mid-migration: one body already written, index still v5.
    await LocalStorage.setItem(segmentsKey("e0"), JSON.stringify(segments(4)));
    expect(JSON.parse(v5Payload).version).toBe(5);

    const loaded = await loadHistory();

    expect(loaded).toHaveLength(2);
    expect(await loadSegments("e0")).toHaveLength(4);
    expect(await loadSegments("e1")).toHaveLength(4);
    expect(
      JSON.parse((await LocalStorage.getItem<string>(HISTORY_KEY)) ?? "{}")
        .version,
    ).toBe(HISTORY_SCHEMA_VERSION);
  });

  it("handles entries that never had a transcript (errors, in-flight)", async () => {
    await LocalStorage.setItem(
      HISTORY_KEY,
      JSON.stringify({
        version: 5,
        entries: [
          {
            id: "bad",
            fetchKey: "bad::auto",
            createdAt: new Date(1700000000000).toISOString(),
            videoId: "bad",
            url: "https://www.youtube.com/watch?v=bad",
            title: "Failed one",
            segmentCount: 0,
            status: "error",
            errorLog: "No captions found for this video.",
          },
        ],
      }),
    );

    const [migrated] = await loadHistory();

    expect(migrated.status).toBe("error");
    expect(migrated.wordCount).toBeUndefined();
    expect(await loadSegments("bad")).toBeUndefined();
    expect(__keys()).toEqual([HISTORY_KEY]);
  });

  it("migrates a legacy bare-array payload with no version envelope", async () => {
    await LocalStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        {
          id: "old",
          fetchKey: "old::auto",
          createdAt: new Date(1700000000000).toISOString(),
          videoId: "old",
          url: "https://www.youtube.com/watch?v=old",
          title: "Ancient",
          segmentCount: 4,
          rawSegments: segments(4),
          status: "finished",
        },
      ]),
    );

    const loaded = await loadHistory();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].rawSegments).toBeUndefined();
    expect(await loadSegments("old")).toHaveLength(4);
  });
});
