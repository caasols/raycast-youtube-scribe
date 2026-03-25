import { describe, expect, it } from "vitest";
import {
  buildHistoryDetailMarkdown,
  buildHistoryDetailViewModel,
  renderHistoryDetailMarkdown,
} from "../src/lib/history-detail";
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
  videoMetadata: {
    channelName: "Rick Astley",
    creatorHandle: "@RickAstleyYT",
    creatorUrl: "https://www.youtube.com/@RickAstleyYT",
    uploadDate: "2009-10-25",
    description: "The official video description.",
    tags: [
      "music",
      "pop",
      "tag3",
      "tag4",
      "tag5",
      "tag6",
      "tag7",
      "tag8",
      "tag9",
    ],
  },
};

describe("buildHistoryDetailMarkdown", () => {
  it("builds a structured view model with explicit content sections", () => {
    const viewModel = buildHistoryDetailViewModel(baseEntry, "text");

    expect(viewModel.title).toEqual({
      level: 1,
      text: "Video",
    });
    expect(viewModel.thumbnail).toEqual({
      alt: "",
      url: "https://img.youtube.com/vi/abc/mqdefault.jpg",
    });
    expect(viewModel.primaryPills).toEqual([
      "Ready",
      "Rick Astley",
      "00:01",
      "2 words",
      "~1 min read",
      "auto",
      expect.stringMatching(/^Saved on /),
    ]);
    expect(viewModel.secondaryPills).toEqual([
      "music",
      "pop",
      "tag3",
      "tag4",
      "tag5",
      "tag6",
      "tag7",
      "tag8",
    ]);
    expect(viewModel.body).toEqual({
      kind: "transcript",
      markdown: "[**00:00**](https://www.youtube.com/watch?v=abc&t=0)\nhello world",
    });
  });

  it("renders markdown from the structured view model", () => {
    const markdown = renderHistoryDetailMarkdown(
      buildHistoryDetailViewModel(baseEntry, "text"),
    );

    expect(markdown).toContain("# Video");
    expect(markdown).toContain(
      "![](https://img.youtube.com/vi/abc/mqdefault.jpg)",
    );
    expect(markdown).toContain("`Ready` `Rick Astley`");
    expect(markdown).not.toContain("`@RickAstleyYT`");
    expect(markdown).toContain(
      "`music` `pop` `tag3` `tag4` `tag5` `tag6` `tag7` `tag8`",
    );
    expect(markdown).toContain("hello world");
  });

  it("renders finished transcripts as title, labels, thumbnail, and text blocks", () => {
    const markdown = buildHistoryDetailMarkdown(baseEntry, "text");

    expect(markdown).toContain(
      "![](https://img.youtube.com/vi/abc/mqdefault.jpg)",
    );
    expect(markdown).toContain("# Video");
    expect(markdown).toContain(
      "# Video\n\n---\n\n`Ready` `Rick Astley`",
    );
    // Verify order: title, then pills, then thumbnail
    const titleIdx = markdown.indexOf("# Video");
    const pillsIdx = markdown.indexOf("`Ready`");
    const thumbIdx = markdown.indexOf("![](https://img.youtube.com/vi/abc/mqdefault.jpg)");
    const bodyIdx = markdown.indexOf("hello world");
    const tagsIdx = markdown.indexOf("`music`");
    expect(titleIdx).toBeLessThan(pillsIdx);
    expect(pillsIdx).toBeLessThan(thumbIdx);
    expect(thumbIdx).toBeLessThan(bodyIdx);
    expect(bodyIdx).toBeLessThan(tagsIdx);
    expect(markdown).not.toContain("`@RickAstleyYT`");
    expect(markdown).toContain("`Ready`");
    expect(markdown).toContain("`auto`");
    expect(markdown).toContain("`00:01`");
    expect(markdown).toMatch(/`Saved on .+`/);
    expect(markdown).not.toContain("`Published on 10/25/2009`");
    expect(markdown).not.toContain("## Text");
    expect(markdown).not.toContain("## Debug log");
    expect(markdown).toContain("hello world");
    expect(markdown).toContain("`music`");
    expect(markdown).toContain("`pop`");
    expect(markdown).toContain("`tag8`");
    expect(markdown).not.toContain("`tag9`");
    expect(markdown).not.toContain("## Description");
    expect(markdown).not.toContain("The official video description.");
    expect(markdown).not.toContain("## Transcript");
    expect(markdown).not.toContain("## Tags");
    expect(markdown).not.toContain("\n\nRick Astley • @RickAstleyYT");
  });

  it("still shows debug logs for error entries", () => {
    const entry = {
      ...baseEntry,
      status: "error" as const,
      statusMessage: "Failed to fetch transcript.",
      errorLog: "failed",
      errorKind: "unknown" as const,
    };
    const viewModel = buildHistoryDetailViewModel(entry, "text");
    const markdown = buildHistoryDetailMarkdown(entry, "text");

    expect(viewModel.body).toEqual({
      kind: "debug-log",
      markdown: "## Debug log\n\ndebug info",
    });

    expect(markdown).toContain("# Video");
    expect(markdown).toContain(
      "![](https://img.youtube.com/vi/abc/mqdefault.jpg)",
    );
    expect(markdown).toContain("`Failed`");
    expect(markdown).not.toContain("failed");
    expect(markdown).toContain("## Debug log");
    expect(markdown).toContain("debug info");
  });

  it("uses errorKind to select recovery guidance when debug log is structured", () => {
    const entry: HistoryEntry = {
      ...baseEntry,
      status: "error" as const,
      errorLog: "yt-dlp timed out while fetching captions.",
      errorKind: "timeout",
      debugLog: JSON.stringify({
        at: "2026-03-16T17:15:56.476Z",
        phase: "transcript-error",
        source: "focused-tab",
        friendlyError: "yt-dlp timed out while fetching captions. Please retry.",
        steps: [
          { step: "focused-tab", ok: true },
          { step: "transcript-fetch", ok: false, details: { error: "timed out" } },
        ],
      }),
    };

    const markdown = buildHistoryDetailMarkdown(entry, "text");

    expect(markdown).toContain("## What You Can Do Next");
    expect(markdown).toContain("Retry the fetch");
  });

  it("renders structured error diagnostics when the debug log is JSON", () => {
    const entry = {
      ...baseEntry,
      status: "error" as const,
      errorLog: "yt-dlp timed out while fetching captions.",
      debugLog: JSON.stringify(
        {
          at: "2026-03-16T17:15:56.476Z",
          phase: "transcript-error",
          source: "focused-tab",
          app: "Google Chrome",
          resolvedUrl: "https://www.youtube.com/watch?v=QUHrntlfPo4",
          videoId: "QUHrntlfPo4",
          requestedLanguage: "auto",
          friendlyError:
            "yt-dlp timed out while fetching captions. Please retry.",
          steps: [
            { step: "manual-input", ok: false },
            { step: "clipboard-scan", ok: false },
            {
              step: "focused-tab",
              ok: true,
              details: {
                app: "Google Chrome",
                value: "https://www.youtube.com/watch?v=QUHrntlfPo4",
                title: "Example title",
              },
            },
            {
              step: "transcript-fetch",
              ok: false,
              details: { error: "yt-dlp timed out while fetching captions." },
            },
          ],
        },
        null,
        2,
      ),
    };

    const markdown = buildHistoryDetailMarkdown(entry, "text");

    expect(markdown).toContain("## What Happened");
    expect(markdown).toContain("yt-dlp timed out while fetching captions. Please retry.");
    expect(markdown).toContain("## What We Tried");
    expect(markdown).toContain("## What You Can Do Next");
    expect(markdown).toContain("Retry the fetch in a few seconds.");
    expect(markdown).toContain("## Technical Details");
    expect(markdown).toContain("Google Chrome");
    expect(markdown).toContain("focused-tab");
    expect(markdown).toContain("Detected focused tab");
    expect(markdown).toContain("Failed: Fetch transcript");
    expect(markdown).not.toContain('{"at"');
  });

  it("prefers video metadata thumbnail and duration text fallbacks when segments are missing", () => {
    const viewModel = buildHistoryDetailViewModel(
      {
        ...baseEntry,
        rawSegments: undefined,
        videoMetadata: {
          ...baseEntry.videoMetadata,
          thumbnailUrl: "https://example.com/thumb.jpg",
          durationText: "06:16",
        },
      },
      "text",
    );

    expect(viewModel.thumbnail.url).toBe("https://example.com/thumb.jpg");
    expect(viewModel.primaryPills).toContain("06:16");
  });

  it("falls back to saved date when publish date is unavailable", () => {
    const viewModel = buildHistoryDetailViewModel(
      {
        ...baseEntry,
        videoMetadata: {
          ...baseEntry.videoMetadata,
          uploadDate: undefined,
        },
      },
      "text",
    );

    expect(viewModel.primaryPills).toContain("Ready");
    expect(viewModel.primaryPills).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Saved on /)]),
    );
    expect(viewModel.primaryPills.some((p) => p.startsWith("Published on "))).toBe(false);
  });

  it("shows channel name even when it matches the handle format", () => {
    const viewModel = buildHistoryDetailViewModel(
      {
        ...baseEntry,
        videoMetadata: {
          ...baseEntry.videoMetadata,
          channelName: "@RickAstleyYT",
          creatorHandle: "@RickAstleyYT",
          tags: [],
        },
      },
      "text",
    );

    expect(viewModel.primaryPills).toContain("@RickAstleyYT");
    expect(
      viewModel.primaryPills.filter((pill) => pill === "@RickAstleyYT"),
    ).toHaveLength(1);
    expect(viewModel.secondaryPills).toEqual([]);
  });

  it("adds a Short pill for shorts entries", () => {
    const viewModel = buildHistoryDetailViewModel(
      {
        ...baseEntry,
        contentKind: "short",
      },
      "text",
    );

    expect(viewModel.primaryPills).toContain("Short");
    expect(viewModel.primaryPills[0]).toBe("Ready");
    expect(viewModel.primaryPills[1]).toBe("Short");
  });

  it("truncates long titles to a single-line approximation with ellipsis", () => {
    const entry = {
      ...baseEntry,
      title:
        "This is a very long YouTube video title that should be shortened in the right pane before it wraps onto a second line",
    };
    const markdown = buildHistoryDetailMarkdown(entry, "text", {
      surface: "history-pane",
    });
    const detailMarkdown = buildHistoryDetailMarkdown(entry, "text", {
      surface: "full-detail",
    });

    expect(markdown).toMatch(/^# .+\.\.\.$/m);
    expect(detailMarkdown).toMatch(/^# .+\.\.\.$/m);
    expect(markdown.length).toBeLessThan(detailMarkdown.length);
    expect(markdown).not.toContain(
      "# This is a very long YouTube video title that should be shortened in the right pane before it wraps onto a second line",
    );
    expect(detailMarkdown).not.toContain(
      "# This is a very long YouTube video title that should be shortened in the right pane before it wraps onto a second line",
    );
  });

  it("allows a longer title in full detail than in the history pane", () => {
    const entry = {
      ...baseEntry,
      title:
        "An intentionally medium-length title that should still gain room in the full detail view",
    };
    const historyViewModel = buildHistoryDetailViewModel(entry, "text", {
      surface: "history-pane",
    });
    const fullDetailViewModel = buildHistoryDetailViewModel(entry, "text", {
      surface: "full-detail",
    });

    expect(historyViewModel.title.text.endsWith("...")).toBe(true);
    expect(fullDetailViewModel.title.text.length).toBeGreaterThan(
      historyViewModel.title.text.length,
    );
  });

  it("truncates medium-length headings that still wrap in the history pane", () => {
    const markdown = buildHistoryDetailMarkdown(
      {
        ...baseEntry,
        title: "7 new open source AI tools you need right now...",
      },
      "text",
      { surface: "history-pane" },
    );

    expect(markdown).toMatch(/^# .+\.\.\.$/m);
    expect(markdown).toMatch(/^# 7 new open source AI tools .+\.\.\.$/m);
    expect(markdown).not.toContain(
      "# 7 new open source AI tools you need right now...",
    );
  });
});
