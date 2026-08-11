import { describe, expect, it, vi } from "vitest";
import { prepareTranscriptJob } from "../src/commands/get-youtube-transcript/transcript-job";
import type { HistoryEntry } from "../src/types";

/**
 * The background worker is what makes a fetch survive the Raycast window closing.
 * Anything awaited before `backgroundTask` is returned is a window in which the
 * user can dismiss Raycast and lose the fetch entirely. The oembed title lookup
 * is a network round trip, so it must not sit on that path.
 */
function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    readClipboardText: vi.fn().mockResolvedValue(undefined),
    getFocusedYoutubeUrl: vi.fn(),
    getFocusedTabContext: vi.fn().mockReturnValue({
      url: "",
      app: "Google Chrome",
      title: "",
    }),
    loadHistory: vi.fn().mockResolvedValue([] as HistoryEntry[]),
    prependHistory: vi.fn().mockResolvedValue([]),
    patchHistoryEntry: vi.fn().mockResolvedValue([]),
    patchHistoryEntryAndMoveToFront: vi.fn().mockResolvedValue([]),
    fetchVideoTitle: vi.fn().mockResolvedValue("Fetched title"),
    findYtDlp: vi.fn(),
    fetchTranscriptWithYtDlp: vi.fn(),
    ...overrides,
  };
}

describe("time-to-worker", () => {
  it("returns the background task without waiting on the oembed title lookup", async () => {
    let releaseTitle: (value: string) => void = () => {};
    const titlePending = new Promise<string>((resolve) => {
      releaseTitle = resolve;
    });
    const deps = makeDeps({
      fetchVideoTitle: vi.fn().mockReturnValue(titlePending),
    });

    const jobPromise = prepareTranscriptJob(
      "https://www.youtube.com/watch?v=abc123def45",
      "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deps as any,
    );

    // The title lookup is deliberately still in flight here.
    const job = await jobPromise;

    expect(job.backgroundTask).toBeDefined();
    expect(job.backgroundTask?.videoId).toBe("abc123def45");
    expect(deps.fetchVideoTitle).toHaveBeenCalled();

    releaseTitle("Fetched title");
  });

  it("persists the pending entry before returning, so the worker can find it", async () => {
    const deps = makeDeps();

    const job = await prepareTranscriptJob(
      "https://www.youtube.com/watch?v=abc123def45",
      "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deps as any,
    );

    expect(deps.prependHistory).toHaveBeenCalled();
    const written = deps.prependHistory.mock.calls[0][0] as HistoryEntry;
    expect(written.id).toBe(job.backgroundTask?.entryId);
    expect(written.status).toBe("fetching");
  });

  it("still carries the cookie browser, which the worker needs for auth-gated videos", async () => {
    const deps = makeDeps();

    const job = await prepareTranscriptJob(
      "https://www.youtube.com/watch?v=abc123def45",
      "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deps as any,
    );

    expect(job.backgroundTask?.cookieBrowserApp).toBe("Google Chrome");
  });
});
