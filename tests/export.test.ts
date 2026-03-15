import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportFormat, HistoryEntry, TranscriptSegment } from "../src/types";

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn().mockReturnValue("/mock/home"),
}));

import {
  buildExportFilename,
  buildPlainReadableOutput,
  buildSrtOutput,
  exportTranscript,
  sanitizeFilename,
  saveToDownloads,
} from "../src/lib/export";

const rawSegments: TranscriptSegment[] = [
  { text: "Hello world", start_ms: 5000, duration_ms: 2000 },
  { text: "Second line", start_ms: 10000, duration_ms: 3000 },
];

const baseEntry: HistoryEntry = {
  id: "1",
  fetchKey: "abc::auto",
  createdAt: "2026-03-14T10:00:00.000Z",
  videoId: "abc",
  url: "https://www.youtube.com/watch?v=abc",
  title: "My Video Title",
  segmentCount: 2,
  rawSegments,
  status: "finished",
};

describe("sanitizeFilename", () => {
  it("keeps safe characters", () => {
    expect(sanitizeFilename("hello_world-2024.txt")).toBe(
      "hello_world-2024.txt",
    );
  });

  it("replaces unsafe characters with hyphens", () => {
    expect(sanitizeFilename("hello/world:test")).toBe("hello-world-test");
  });

  it("collapses consecutive hyphens", () => {
    expect(sanitizeFilename("hello///world")).toBe("hello-world");
  });

  it("truncates to 80 chars at word boundary", () => {
    const long = "word ".repeat(20).trim(); // 99 chars
    const result = sanitizeFilename(long);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result).not.toMatch(/-$/);
  });

  it("falls back to 'transcript' for empty input", () => {
    expect(sanitizeFilename("")).toBe("transcript");
  });

  it("falls back to 'transcript' for unsafe-only input", () => {
    expect(sanitizeFilename("///")).toBe("transcript");
  });

  it("trims leading/trailing hyphens and spaces", () => {
    expect(sanitizeFilename("---hello---")).toBe("hello");
    expect(sanitizeFilename("  hello  ")).toBe("hello");
  });
});

describe("buildPlainReadableOutput", () => {
  it("formats with bracketed timestamps", () => {
    const result = buildPlainReadableOutput(rawSegments);
    expect(result).toContain("[00:05]");
  });

  it("does not include markdown bold markers", () => {
    const result = buildPlainReadableOutput(rawSegments);
    expect(result).not.toContain("**");
  });

  it("returns empty string for empty segments", () => {
    expect(buildPlainReadableOutput([])).toBe("");
  });
});

describe("buildSrtOutput", () => {
  it("produces valid SRT format", () => {
    const segs: TranscriptSegment[] = [
      { text: "Hello", start_ms: 0, duration_ms: 2000 },
      { text: "World", start_ms: 2000, duration_ms: 3000 },
    ];
    const result = buildSrtOutput(segs);
    expect(result).toBe(
      "1\n00:00:00,000 --> 00:00:02,000\nHello\n\n2\n00:00:02,000 --> 00:00:05,000\nWorld",
    );
  });

  it("handles timestamps over an hour", () => {
    const segs: TranscriptSegment[] = [
      { text: "Late", start_ms: 3661000, duration_ms: 2000 },
    ];
    const result = buildSrtOutput(segs);
    expect(result).toContain("01:01:01,000 --> 01:01:03,000");
  });

  it("returns empty string for empty segments", () => {
    expect(buildSrtOutput([])).toBe("");
  });
});

describe("exportTranscript", () => {
  it("dispatches plain format correctly", () => {
    const result = exportTranscript(baseEntry, "plain");
    expect(result).toBe("Hello world Second line");
  });

  it("dispatches readable format correctly", () => {
    const result = exportTranscript(baseEntry, "readable");
    expect(result).toContain("[00:05]");
    expect(result).not.toContain("**");
  });

  it("dispatches json format correctly", () => {
    const result = exportTranscript(baseEntry, "json");
    expect(result).toContain('"text": "Hello world"');
  });

  it("dispatches srt format correctly", () => {
    const result = exportTranscript(baseEntry, "srt");
    expect(result).toContain("00:00:05,000 --> 00:00:07,000");
  });

  it("returns empty string for entry with no segments", () => {
    const entry = { ...baseEntry, rawSegments: undefined };
    expect(exportTranscript(entry, "plain")).toBe("");
  });

  it("returns empty string for entry with empty segments", () => {
    const entry = { ...baseEntry, rawSegments: [] };
    expect(exportTranscript(entry, "plain")).toBe("");
  });
});

describe("buildExportFilename", () => {
  it("uses .txt extension for plain format", () => {
    expect(buildExportFilename(baseEntry, "plain")).toBe("My Video Title.txt");
  });

  it("uses -readable.txt extension for readable format", () => {
    expect(buildExportFilename(baseEntry, "readable")).toBe(
      "My Video Title-readable.txt",
    );
  });

  it("uses .json extension for json format", () => {
    expect(buildExportFilename(baseEntry, "json")).toBe("My Video Title.json");
  });

  it("uses .srt extension for srt format", () => {
    expect(buildExportFilename(baseEntry, "srt")).toBe("My Video Title.srt");
  });
});

describe("saveToDownloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes to ~/Downloads and returns the full path", async () => {
    const { writeFile } = await import("node:fs/promises");
    const { homedir } = await import("node:os");

    const path = await saveToDownloads("test.txt", "content here");

    expect(homedir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith(
      "/mock/home/Downloads/test.txt",
      "content here",
      "utf8",
    );
    expect(path).toBe("/mock/home/Downloads/test.txt");
  });
});
