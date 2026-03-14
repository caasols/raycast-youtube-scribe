import { execFile, execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { BROWSER_COOKIE_MAP } from "./browser";
import { buildJsonOutput, buildTextOutput } from "./output";
import { normalizeLanguage } from "./youtube";
import { parseVtt } from "./vtt";
import { TranscriptDiagnostics, TranscriptResult } from "../types";

const execFileAsync = promisify(execFile);

const YT_DLP_CANDIDATES = [
  "/opt/homebrew/bin/yt-dlp",
  "/usr/local/bin/yt-dlp",
  "/usr/bin/yt-dlp",
  path.join(process.env.HOME ?? "", "Library/Python/3.9/bin/yt-dlp"),
  path.join(process.env.HOME ?? "", "Library/Python/3.10/bin/yt-dlp"),
  path.join(process.env.HOME ?? "", "Library/Python/3.11/bin/yt-dlp"),
  path.join(process.env.HOME ?? "", "Library/Python/3.12/bin/yt-dlp"),
];

const PLAYER_CLIENTS = ["default", "ios", "mweb", "web"] as const;
const YT_DLP_TIMEOUT_MS = 15_000;

export type YtDlpLocation = {
  path: string;
  source: "candidate" | "which";
};

export type FetchTranscriptWithYtDlpOptions = {
  videoUrl: string;
  requestedLanguage?: string;
  browserApp?: string;
  ytDlpPath: string;
};

function trimSnippet(input?: string): string {
  return (input ?? "").trim().slice(0, 800);
}

export function findYtDlp(): YtDlpLocation | null {
  for (const candidate of YT_DLP_CANDIDATES) {
    if (candidate && existsSync(candidate)) {
      return { path: candidate, source: "candidate" };
    }
  }

  try {
    const discovered = execFileSync("which", ["yt-dlp"], {
      encoding: "utf-8",
    }).trim();
    if (discovered) {
      return { path: discovered, source: "which" };
    }
  } catch {
    // ignore which failures
  }

  return null;
}

function detectEffectiveLanguage(
  filename: string,
  requestedLanguage: string,
): string {
  const match = filename.match(/\.([a-zA-Z0-9-]{2,10})\.vtt$/);
  return match?.[1] ?? requestedLanguage ?? "auto";
}

async function runYtDlpCommand(
  args: string[],
  diagnostics: TranscriptDiagnostics,
): Promise<void> {
  try {
    const { stdout, stderr } = await execFileAsync(args[0], args.slice(1), {
      encoding: "utf-8",
      timeout: YT_DLP_TIMEOUT_MS,
    });
    diagnostics.stdoutSnippet = trimSnippet(stdout);
    diagnostics.stderrSnippet = trimSnippet(stderr);
  } catch (error) {
    const details = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    diagnostics.stdoutSnippet = trimSnippet(details.stdout ?? "");
    diagnostics.stderrSnippet = trimSnippet(
      details.stderr ?? details.message ?? "",
    );
    if (
      (details as { killed?: boolean }).killed ||
      (details as { signal?: string }).signal === "SIGTERM"
    ) {
      throw new Error(
        `yt-dlp timed out after ${YT_DLP_TIMEOUT_MS}ms while fetching captions.`,
      );
    }
    throw error;
  }
}

export async function fetchTranscriptWithYtDlp(
  options: FetchTranscriptWithYtDlpOptions,
): Promise<TranscriptResult> {
  const requestedLanguage = normalizeLanguage(options.requestedLanguage);
  const cookieBrowser = options.browserApp
    ? (BROWSER_COOKIE_MAP[options.browserApp] ?? "chrome")
    : "chrome";
  const diagnostics: TranscriptDiagnostics = {
    ytDlpPath: options.ytDlpPath,
    requestedLanguage: requestedLanguage || "auto",
    browserApp: options.browserApp,
    cookieBrowser,
    attemptedClients: [],
    subtitleFiles: [],
  };
  const tempDir = mkdtempSync(path.join(tmpdir(), "youtube-scribe-"));
  const outputTemplate = path.join(tempDir, "transcript");

  try {
    const languages = requestedLanguage
      ? `${requestedLanguage}.*,${requestedLanguage}`
      : "en.*,en";

    for (const playerClient of PLAYER_CLIENTS) {
      diagnostics.attemptedClients?.push(playerClient);

      const args = [
        options.ytDlpPath,
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-format",
        "vtt",
        "--sub-langs",
        languages,
        "--output",
        outputTemplate,
      ];

      args.push("--cookies-from-browser", cookieBrowser);

      if (playerClient !== "default") {
        args.push("--extractor-args", `youtube:player_client=${playerClient}`);
      }

      args.push(options.videoUrl);

      await runYtDlpCommand(args, diagnostics);

      const subtitleFiles = readdirSync(tempDir)
        .filter((file) => file.endsWith(".vtt"))
        .sort();

      diagnostics.subtitleFiles = subtitleFiles;
      if (subtitleFiles.length > 0) {
        const subtitlePath = path.join(tempDir, subtitleFiles[0]);
        const rawSegments = parseVtt(readFileSync(subtitlePath, "utf-8"));
        const textOutput = buildTextOutput(rawSegments);

        if (!textOutput) {
          throw new Error(
            requestedLanguage
              ? `Transcript was empty for language '${requestedLanguage}'. Try leaving language blank to auto-detect.`
              : "Transcript was empty for this video. It may have no accessible transcript track.",
          );
        }

        const effectiveLanguage = detectEffectiveLanguage(
          subtitleFiles[0],
          requestedLanguage,
        );
        diagnostics.effectiveLanguage = effectiveLanguage;

        return {
          rawSegments,
          textOutput,
          jsonOutput: buildJsonOutput(rawSegments),
          segmentCount: rawSegments.length,
          requestedLanguage,
          effectiveLanguage,
          provider: "yt-dlp",
          diagnostics,
        };
      }
    }

    const fallbackArgs = [
      options.ytDlpPath,
      "--skip-download",
      "--write-subs",
      "--write-auto-subs",
      "--sub-format",
      "vtt",
      "--sub-langs",
      "all",
      "--output",
      outputTemplate,
    ];

    fallbackArgs.push("--cookies-from-browser", cookieBrowser);

    fallbackArgs.push(options.videoUrl);
    await runYtDlpCommand(fallbackArgs, diagnostics);

    const subtitleFiles = readdirSync(tempDir)
      .filter((file) => file.endsWith(".vtt"))
      .sort();
    diagnostics.subtitleFiles = subtitleFiles;

    if (subtitleFiles.length === 0) {
      throw new Error("No captions found for this video.");
    }

    const subtitlePath = path.join(tempDir, subtitleFiles[0]);
    const rawSegments = parseVtt(readFileSync(subtitlePath, "utf-8"));
    const textOutput = buildTextOutput(rawSegments);
    if (!textOutput) {
      throw new Error(
        "Transcript was empty for this video. It may have no accessible transcript track.",
      );
    }

    const effectiveLanguage = detectEffectiveLanguage(
      subtitleFiles[0],
      requestedLanguage,
    );
    diagnostics.effectiveLanguage = effectiveLanguage;

    return {
      rawSegments,
      textOutput,
      jsonOutput: buildJsonOutput(rawSegments),
      segmentCount: rawSegments.length,
      requestedLanguage,
      effectiveLanguage,
      provider: "yt-dlp",
      diagnostics,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
