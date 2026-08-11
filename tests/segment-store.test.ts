import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorage } from "@raycast/api";
// Helpers live on the vitest mock, which "@raycast/api" is aliased to at runtime.
import { __keys, __resetLocalStorage } from "./__mocks__/@raycast/api";
import {
  HISTORY_KEY,
  SEGMENTS_KEY_PREFIX,
  clearHistory,
  loadHistory,
  loadHydratedEntry,
  loadSegments,
  patchHistoryEntry,
  prependHistory,
  removeHistoryEntry,
  saveHistory,
  segmentsKey,
} from "../src/history-store";
import { serializeHistory } from "../src/lib/history-persistence";
import type { HistoryEntry, TranscriptSegment } from "../src/types";

function segments(n: number, seed = 0): TranscriptSegment[] {
  return Array.from({ length: n }, (_, i) => ({
    text: `seed${seed} segment ${i} some spoken words here`,
    start_ms: i * 1000,
    duration_ms: 1000,
  }));
}

function entry(
  id: string,
  overrides: Partial<HistoryEntry> = {},
): HistoryEntry {
  return {
    id,
    fetchKey: `${id}::auto`,
    createdAt: new Date(1700000000000).toISOString(),
    videoId: id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title: `Video ${id}`,
    segmentCount: 3,
    rawSegments: segments(3),
    status: "finished",
    ...overrides,
  };
}

beforeEach(() => {
  __resetLocalStorage();
});

describe("persisted index shape", () => {
  it("never writes rawSegments into the history index", async () => {
    await saveHistory([entry("a"), entry("b")]);

    const raw = (await LocalStorage.getItem<string>(HISTORY_KEY)) ?? "";
    expect(raw).not.toContain("rawSegments");
    expect(raw.length).toBeLessThan(2000);
  });

  it("serializeHistory strips rawSegments even when handed hydrated entries", () => {
    const raw = serializeHistory([entry("a")], {
      maxEntries: 100,
      maxAgeDays: null,
    });
    expect(JSON.parse(raw).entries[0].rawSegments).toBeUndefined();
  });

  it("writes one segments key per entry", async () => {
    await saveHistory([entry("a"), entry("b")]);

    expect(__keys()).toEqual(
      [HISTORY_KEY, segmentsKey("a"), segmentsKey("b")].sort(),
    );
    expect(segmentsKey("a")).toBe(`${SEGMENTS_KEY_PREFIX}a`);
  });
});

describe("reading", () => {
  it("loadHistory returns lean entries without transcript bodies", async () => {
    await saveHistory([entry("a")]);

    const loaded = await loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].rawSegments).toBeUndefined();
    expect(loaded[0].title).toBe("Video a");
  });

  it("loadSegments returns the stored transcript", async () => {
    await saveHistory([entry("a", { rawSegments: segments(5, 1) })]);

    const loaded = await loadSegments("a");
    expect(loaded).toHaveLength(5);
    expect(loaded?.[0].text).toContain("seed1");
  });

  it("loadHydratedEntry reattaches the transcript", async () => {
    await saveHistory([entry("a", { rawSegments: segments(4) })]);

    const hydrated = await loadHydratedEntry("a");
    expect(hydrated?.rawSegments).toHaveLength(4);
  });

  it("loadHydratedEntry returns undefined for an unknown id", async () => {
    expect(await loadHydratedEntry("nope")).toBeUndefined();
  });
});

describe("writing", () => {
  it("prependHistory splits the entry on write", async () => {
    await prependHistory(entry("a"));

    const raw = (await LocalStorage.getItem<string>(HISTORY_KEY)) ?? "";
    expect(raw).not.toContain("rawSegments");
    expect(await loadSegments("a")).toHaveLength(3);
  });

  it("patchHistoryEntry persists newly supplied segments", async () => {
    await prependHistory(
      entry("a", {
        status: "fetching",
        rawSegments: undefined,
        segmentCount: 0,
      }),
    );
    expect(await loadSegments("a")).toBeUndefined();

    await patchHistoryEntry("a", {
      status: "finished",
      rawSegments: segments(7),
      segmentCount: 7,
    });

    expect(await loadSegments("a")).toHaveLength(7);
    const raw = (await LocalStorage.getItem<string>(HISTORY_KEY)) ?? "";
    expect(raw).not.toContain("rawSegments");
  });

  it("patchHistoryEntry leaves existing segments alone when the patch omits them", async () => {
    await prependHistory(entry("a", { rawSegments: segments(6) }));
    await patchHistoryEntry("a", { pinned: true });

    expect(await loadSegments("a")).toHaveLength(6);
    expect((await loadHistory())[0].pinned).toBe(true);
  });
});

describe("deletion", () => {
  it("removeHistoryEntry drops the index row and its segments", async () => {
    await saveHistory([entry("a"), entry("b")]);
    await removeHistoryEntry("a");

    expect((await loadHistory()).map((e) => e.id)).toEqual(["b"]);
    expect(await loadSegments("a")).toBeUndefined();
    expect(await loadSegments("b")).toHaveLength(3);
  });

  it("clearHistory removes every segments key too", async () => {
    await saveHistory([entry("a"), entry("b")]);
    await clearHistory();

    expect(__keys()).toEqual([]);
  });

  it("clearHistory strands nothing when history exceeds the default cap", async () => {
    // The default retention cap is 100. With a raised History Limit the index can
    // hold more, and every one of those bodies still has to be cleaned up.
    const many = Array.from({ length: 120 }, (_, i) =>
      entry(`e${i}`, {
        createdAt: new Date(1700000000000 + i * 1000).toISOString(),
      }),
    );
    await saveHistory(many, { maxEntries: 500, maxAgeDays: null });
    expect(__keys()).toHaveLength(121);

    await clearHistory();

    expect(__keys()).toEqual([]);
  });

  it("pruning by retention limit deletes the dropped entries' segments", async () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      entry(`e${i}`, {
        createdAt: new Date(1700000000000 + i * 1000).toISOString(),
      }),
    );
    await saveHistory(many);
    expect(__keys()).toHaveLength(6); // index + 5 bodies

    // Retention drops the two oldest; their bodies must not be orphaned.
    await saveHistory(many, { maxEntries: 3, maxAgeDays: null });

    const remaining = (await loadHistory()).map((e) => e.id);
    expect(remaining).toEqual(["e4", "e3", "e2"]);
    expect(await loadSegments("e0")).toBeUndefined();
    expect(await loadSegments("e1")).toBeUndefined();
    expect(__keys()).toHaveLength(4); // index + 3 bodies
  });
});
