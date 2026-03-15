import { describe, expect, it, vi } from "vitest";

const execFileMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

describe("yt-dlp command execution", () => {
  it("captures command snippets for successful executions", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, callback) =>
      callback(null, "stdout text", "stderr text"),
    );

    const { runYtDlpCommand } = await import("../src/lib/ytdlp-command");

    const diagnostics = await runYtDlpCommand(["/bin/yt-dlp", "--version"]);

    expect(diagnostics).toEqual({
      stdoutSnippet: "stdout text",
      stderrSnippet: "",
    });
  });

  it("maps SIGTERM kills to the transcript timeout error", async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, callback) =>
      callback({ killed: true, signal: "SIGTERM", stdout: "", stderr: "" }),
    );

    const { runYtDlpCommand } = await import("../src/lib/ytdlp-command");

    await expect(runYtDlpCommand(["/bin/yt-dlp", "--version"])).rejects.toThrow(
      "yt-dlp timed out after 30000ms",
    );
  });
});
