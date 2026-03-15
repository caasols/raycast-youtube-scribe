import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryEntry, TranscriptResult } from "../src/types";

function makeBaseEntry(): HistoryEntry {
  return {
    id: "entry-1",
    fetchKey: "abc123def45::auto",
    createdAt: "2026-03-15T10:00:00.000Z",
    videoId: "abc123def45",
    url: "https://www.youtube.com/watch?v=abc123def45",
    title: "Video",
    segmentCount: 0,
    status: "finished",
  };
}

function makeResult(): TranscriptResult {
  return {
    rawSegments: [{ text: "hello", start_ms: 0, duration_ms: 1000 }],
    textOutput: "hello",
    jsonOutput: '[{"text":"hello"}]',
    segmentCount: 1,
    requestedLanguage: "en",
    effectiveLanguage: "en",
    provider: "yt-dlp",
    diagnostics: {},
  };
}

describe("transcript job orchestration", () => {
  const deps = {
    readClipboardText: vi.fn(),
    getFocusedYoutubeUrl: vi.fn(),
    getFocusedTabContext: vi.fn(),
    loadHistory: vi.fn(),
    prependHistory: vi.fn(),
    patchHistoryEntry: vi.fn(),
    patchHistoryEntryAndMoveToFront: vi.fn(),
    fetchVideoTitle: vi.fn(),
    findYtDlp: vi.fn(),
    fetchTranscriptWithYtDlp: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deps.readClipboardText.mockResolvedValue("");
    deps.getFocusedTabContext.mockReturnValue({
      url: "https://www.youtube.com/watch?v=abc123def45",
      title: "Focused title",
      app: "Google Chrome",
    });
    deps.prependHistory.mockResolvedValue([]);
    deps.patchHistoryEntry.mockResolvedValue([]);
    deps.patchHistoryEntryAndMoveToFront.mockResolvedValue([]);
    deps.fetchVideoTitle.mockResolvedValue("Fetched title");
    deps.findYtDlp.mockReturnValue({
      path: "/opt/homebrew/bin/yt-dlp",
      source: "candidate",
    });
    deps.fetchTranscriptWithYtDlp.mockResolvedValue(makeResult());
  });

  it("returns a cached finished entry without refetching", async () => {
    const reusable: HistoryEntry = {
      ...makeBaseEntry(),
      segmentCount: 2,
      rawSegments: [
        { text: "hello", start_ms: 0, duration_ms: 1000 },
        { text: "world", start_ms: 1000, duration_ms: 1000 },
      ],
    };
    deps.loadHistory.mockResolvedValue([reusable]);

    const { prepareTranscriptJob } =
      await import("../src/commands/get-youtube-transcript/transcript-job");

    const result = await prepareTranscriptJob(
      "https://www.youtube.com/watch?v=abc123def45",
      "",
      deps,
    );

    expect(result).toEqual({
      fromCache: true,
      entry: reusable,
      backgroundTask: undefined,
    });
    expect(deps.fetchTranscriptWithYtDlp).not.toHaveBeenCalled();
  });

  it("reuses the failed history row id when retrying the same fetch key", async () => {
    const retryable: HistoryEntry = {
      ...makeBaseEntry(),
      id: "failed-entry",
      fetchKey: "abc123def45::en",
      language: "en",
      status: "error",
      statusMessage: "Failed to fetch transcript.",
    };
    deps.loadHistory.mockResolvedValue([retryable]);

    const { prepareTranscriptJob, runPreparedTranscriptJob } =
      await import("../src/commands/get-youtube-transcript/transcript-job");

    const prepared = await prepareTranscriptJob(
      "https://www.youtube.com/watch?v=abc123def45",
      "en",
      deps,
    );

    expect(deps.patchHistoryEntryAndMoveToFront).toHaveBeenCalledWith(
      "failed-entry",
      expect.objectContaining({
        id: "failed-entry",
        fetchKey: "abc123def45::en",
        status: "fetching",
      }),
    );
    expect(prepared.fromCache).toBe(false);
    expect(prepared.backgroundTask).toBeDefined();

    const result = await runPreparedTranscriptJob(
      prepared.backgroundTask!,
      deps,
    );
    expect(result.id).toBe("failed-entry");
    expect(result.status).toBe("finished");
  });

  it("maps missing yt-dlp to the actionable install message", async () => {
    const { toTranscriptError } =
      await import("../src/commands/get-youtube-transcript/transcript-job");

    expect(
      toTranscriptError(new Error("yt-dlp is not installed on this machine"))
        .error.message,
    ).toContain("brew install yt-dlp");
    expect(
      toTranscriptError(new Error("yt-dlp is not installed on this machine"))
        .error.message,
    ).toContain("pipx install yt-dlp");
  });

  it("prepares a pending fetch plan without running yt-dlp immediately", async () => {
    deps.loadHistory.mockResolvedValue([]);

    const { prepareTranscriptJob } = await import(
      "../src/commands/get-youtube-transcript/transcript-job"
    );

    const result = await prepareTranscriptJob(
      "https://www.youtube.com/shorts/abc123def45",
      "en",
      deps,
    );

    expect(result.fromCache).toBe(false);
    expect(result.entry.status).toBe("fetching");
    expect(result.entry.contentKind).toBe("short");
    expect(result.backgroundTask).toEqual(
      expect.objectContaining({
        entryId: result.entry.id,
        resolvedUrl: "https://www.youtube.com/shorts/abc123def45",
        videoId: "abc123def45",
        contentKind: "short",
        requestedLanguage: "en",
      }),
    );
    expect(deps.fetchTranscriptWithYtDlp).not.toHaveBeenCalled();
  });

  it("uses yt-dlp metadata title when oembed title equals video ID", async () => {
    const { prepareTranscriptJob, runPreparedTranscriptJob } = await import(
      "../src/commands/get-youtube-transcript/transcript-job"
    );
    deps.loadHistory.mockResolvedValue([]);
    deps.fetchVideoTitle.mockResolvedValue("abc123def45"); // oembed failed, returned video ID

    const resultWithMetadata = makeResult();
    resultWithMetadata.videoMetadata = {
      title: "Real Video Title",
      channelName: "Channel",
    };
    deps.fetchTranscriptWithYtDlp.mockResolvedValue(resultWithMetadata);

    const prepared = await prepareTranscriptJob(
      "https://www.youtube.com/watch?v=abc123def45",
      "en",
      deps,
    );

    const result = await runPreparedTranscriptJob(
      prepared.backgroundTask!,
      deps,
    );

    expect(result.title).toBe("Real Video Title");
  });

  it("executes a prepared background fetch against the existing pending entry", async () => {
    const { prepareTranscriptJob, runPreparedTranscriptJob } = await import(
      "../src/commands/get-youtube-transcript/transcript-job"
    );
    deps.loadHistory.mockResolvedValue([]);

    const prepared = await prepareTranscriptJob(
      "https://www.youtube.com/watch?v=abc123def45",
      "en",
      deps,
    );

    expect(prepared.backgroundTask).toBeDefined();

    const result = await runPreparedTranscriptJob(
      prepared.backgroundTask!,
      deps,
    );

    expect(deps.fetchTranscriptWithYtDlp).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("finished");
    expect(result.id).toBe(prepared.entry.id);
    expect(result.language).toBe("en");
  });
});
