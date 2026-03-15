import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export const YT_DLP_TIMEOUT_MS = 30_000;
export const YT_DLP_METADATA_TIMEOUT_MS = 15_000;

function trimSnippet(input?: string): string {
  return (input ?? "").trim().slice(0, 800);
}

export async function runYtDlpCommand(args: string[]): Promise<{
  stdoutSnippet: string;
  stderrSnippet: string;
}> {
  try {
    const result = await execFileAsync(args[0], args.slice(1), {
      encoding: "utf-8",
      timeout: YT_DLP_TIMEOUT_MS,
    });
    const stdout = typeof result === "string" ? result : (result.stdout ?? "");
    const stderr = typeof result === "string" ? "" : (result.stderr ?? "");

    return {
      stdoutSnippet: trimSnippet(stdout),
      stderrSnippet: trimSnippet(stderr),
    };
  } catch (error) {
    const details = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
      killed?: boolean;
      signal?: string;
    };

    if (details.killed || details.signal === "SIGTERM") {
      throw new Error(
        `yt-dlp timed out after ${YT_DLP_TIMEOUT_MS}ms while fetching captions.`,
      );
    }

    throw error;
  }
}

export async function runYtDlpJsonCommand(args: string[]): Promise<string> {
  const result = await execFileAsync(args[0], args.slice(1), {
    encoding: "utf-8",
    timeout: YT_DLP_METADATA_TIMEOUT_MS,
  });
  return typeof result === "string" ? result : (result.stdout ?? "");
}
