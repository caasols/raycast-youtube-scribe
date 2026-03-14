import { beforeEach, describe, expect, it, vi } from "vitest";
import { findYtDlp, fetchTranscriptWithYtDlp } from "../src/lib/ytdlp";

vi.mock("node:os", () => ({
  tmpdir: () => "/tmp",
}));

const execFileSyncMock = vi.fn();
const execFileMock = vi.fn();
const mkdtempSyncMock = vi.fn();
const readFileSyncMock = vi.fn();
const readdirSyncMock = vi.fn();
const rmSyncMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

vi.mock("node:fs", () => ({
  mkdtempSync: (...args: unknown[]) => mkdtempSyncMock(...args),
  readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
  readdirSync: (...args: unknown[]) => readdirSyncMock(...args),
  rmSync: (...args: unknown[]) => rmSyncMock(...args),
  existsSync: () => false,
}));

describe("yt-dlp provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("discovers yt-dlp from which output when known paths are absent", () => {
    execFileSyncMock.mockReturnValue("/custom/bin/yt-dlp\n");
    expect(findYtDlp()).toEqual({ path: "/custom/bin/yt-dlp", source: "which" });
  });

  it("fails when no subtitle files are produced", async () => {
    mkdtempSyncMock.mockReturnValue("/tmp/ytscribe-123");
    readdirSyncMock.mockReturnValue([]);
    execFileMock.mockImplementation((_bin, _args, _opts, callback) => callback(null, "", ""));

    await expect(
      fetchTranscriptWithYtDlp({
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        requestedLanguage: "en",
        browserApp: "Google Chrome",
        ytDlpPath: "/custom/bin/yt-dlp",
      }),
    ).rejects.toThrow("No captions found for this video.");
  });

  it("falls back to chrome cookies when no browser app is provided", async () => {
    mkdtempSyncMock.mockReturnValue("/tmp/ytscribe-123");
    readdirSyncMock.mockReturnValueOnce(["transcript.en.vtt"]);
    readFileSyncMock.mockReturnValue("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhello\n");
    execFileMock.mockImplementation((_bin, _args, _opts, callback) => callback(null, "", ""));

    await fetchTranscriptWithYtDlp({
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      requestedLanguage: "en",
      ytDlpPath: "/custom/bin/yt-dlp",
    });

    expect(execFileMock).toHaveBeenCalled();
    expect(execFileMock.mock.calls[0][1]).toContain("--cookies-from-browser");
    expect(execFileMock.mock.calls[0][1]).toContain("chrome");
  });

  it("fails fast when a yt-dlp attempt times out", async () => {
    mkdtempSyncMock.mockReturnValue("/tmp/ytscribe-123");
    readdirSyncMock.mockReturnValue([]);
    execFileMock.mockImplementation((_bin, _args, _opts, callback) =>
      callback({ killed: true, signal: "SIGTERM", stdout: "", stderr: "" }),
    );

    await expect(
      fetchTranscriptWithYtDlp({
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        requestedLanguage: "en",
        browserApp: "Google Chrome",
        ytDlpPath: "/custom/bin/yt-dlp",
      }),
    ).rejects.toThrow("yt-dlp timed out");
  });
});
