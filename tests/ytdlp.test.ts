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
    execFileMock
      .mockImplementationOnce((_bin, _args, _opts, callback) =>
        callback(null, "", ""),
      )
      .mockImplementationOnce((_bin, _args, _opts, callback) =>
        callback(
          null,
          JSON.stringify({
            channel: "Rick Astley",
            uploader_id: "@RickAstleyYT",
            uploader_url: "https://www.youtube.com/@RickAstleyYT",
            channel_id: "channel-123",
            channel_url: "https://www.youtube.com/channel/channel-123",
            upload_date: "20091025",
            duration: 213,
            duration_string: "3:33",
            thumbnail: "https://i.ytimg.com/example.jpg",
            description: "A description",
            tags: ["music", "pop"],
            channel_is_verified: true,
          }),
          "",
        ),
      );

    const result = await fetchTranscriptWithYtDlp({
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      requestedLanguage: "en",
      ytDlpPath: "/custom/bin/yt-dlp",
    });

    expect(execFileMock).toHaveBeenCalled();
    // First attempt is without cookies (faster path); cookies used as fallback
    expect(execFileMock.mock.calls[0][1]).not.toContain("--cookies-from-browser");
    expect(result.videoMetadata).toEqual({
      channelName: "Rick Astley",
      creatorHandle: "@RickAstleyYT",
      creatorUrl: "https://www.youtube.com/@RickAstleyYT",
      channelId: "channel-123",
      channelUrl: "https://www.youtube.com/channel/channel-123",
      uploadDate: "2009-10-25",
      durationSeconds: 213,
      durationText: "3:33",
      thumbnailUrl: "https://i.ytimg.com/example.jpg",
      description: "A description",
      tags: ["music", "pop"],
      channelVerified: true,
    });
  });

  it("recovers partial subtitles when a yt-dlp attempt times out", async () => {
    mkdtempSyncMock.mockReturnValue("/tmp/ytscribe-123");
    readdirSyncMock.mockReturnValueOnce(["transcript.en.vtt"]);
    readFileSyncMock.mockReturnValue("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhello\n");
    execFileMock
      .mockImplementationOnce((_bin, _args, _opts, callback) =>
        callback({ killed: true, signal: "SIGTERM", stdout: "", stderr: "" }),
      )
      .mockImplementationOnce((_bin, _args, _opts, callback) =>
        callback(new Error("metadata failed"), "", ""),
      );

    const result = await fetchTranscriptWithYtDlp({
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      requestedLanguage: "en",
      browserApp: "Google Chrome",
      ytDlpPath: "/custom/bin/yt-dlp",
    });

    // Should recover transcript from partial download (1 yt-dlp call + 1 metadata call)
    expect(result.textOutput).toContain("hello");
    expect(execFileMock).toHaveBeenCalledTimes(2);
    expect(result.videoMetadata).toBeUndefined();
  });

  it("does not fail transcript fetch when metadata fetch fails", async () => {
    mkdtempSyncMock.mockReturnValue("/tmp/ytscribe-123");
    readdirSyncMock.mockReturnValueOnce(["transcript.en.vtt"]);
    readFileSyncMock.mockReturnValue("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhello\n");
    execFileMock
      .mockImplementationOnce((_bin, _args, _opts, callback) =>
        callback(null, "", ""),
      )
      .mockImplementationOnce((_bin, _args, _opts, callback) =>
        callback(new Error("metadata failed"), "", ""),
      );

    const result = await fetchTranscriptWithYtDlp({
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      requestedLanguage: "en",
      browserApp: "Google Chrome",
      ytDlpPath: "/custom/bin/yt-dlp",
    });

    expect(result.textOutput).toContain("hello");
    expect(result.videoMetadata).toBeUndefined();
  });
});
