import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTranscriptWithYtDlp } from "../src/lib/ytdlp";

vi.mock("node:os", () => ({ tmpdir: () => "/tmp" }));

const execFileMock = vi.fn();
const mkdtempSyncMock = vi.fn();
const readFileSyncMock = vi.fn();
const readdirSyncMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

vi.mock("node:fs", () => ({
  mkdtempSync: (...args: unknown[]) => mkdtempSyncMock(...args),
  readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
  readdirSync: (...args: unknown[]) => readdirSyncMock(...args),
  rmSync: vi.fn(),
  existsSync: () => false,
}));

const VTT = `WEBVTT

00:00:00.000 --> 00:00:02.000
hello world
`;

/** Every argv the extension handed to yt-dlp during the run. */
function recordedInvocations(): string[][] {
  return execFileMock.mock.calls.map((call) => call[1] as string[]);
}

describe("yt-dlp metadata arguments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mkdtempSyncMock.mockReturnValue("/tmp/ytscribe-1");
    readdirSyncMock.mockReturnValue(["transcript.en.vtt"]);
    readFileSyncMock.mockReturnValue(VTT);
    execFileMock.mockImplementation(
      (_bin: string, args: string[], _opts: unknown, callback: Function) => {
        // The metadata call is the one asking for JSON.
        if (args.includes("--dump-single-json")) {
          return callback(
            null,
            JSON.stringify({ title: "T", channel: "C", duration: 10 }),
            "",
          );
        }
        return callback(null, "", "");
      },
    );
  });

  /**
   * Without this flag yt-dlp still runs format selection for a metadata-only
   * dump. When YouTube's n-challenge fails, no formats resolve and yt-dlp exits
   * with "Requested format is not available" — so metadata silently came back
   * undefined for every fetch, losing channel, thumbnail, duration and counts.
   */
  it("passes --ignore-no-formats-error so metadata survives format-selection failure", async () => {
    await fetchTranscriptWithYtDlp({
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      ytDlpPath: "/usr/local/bin/yt-dlp",
    });

    const metadataCall = recordedInvocations().find((args) =>
      args.includes("--dump-single-json"),
    );

    expect(metadataCall).toBeDefined();
    expect(metadataCall).toContain("--skip-download");
    expect(metadataCall).toContain("--ignore-no-formats-error");
  });

  it("still returns the parsed metadata", async () => {
    const result = await fetchTranscriptWithYtDlp({
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      ytDlpPath: "/usr/local/bin/yt-dlp",
    });

    expect(result.videoMetadata?.title).toBe("T");
    expect(result.videoMetadata?.channelName).toBe("C");
  });
});
