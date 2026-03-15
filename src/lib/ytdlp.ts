import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BROWSER_COOKIE_MAP } from "./browser";
import { buildJsonOutput, buildTextOutput } from "./output";
import { normalizeLanguage } from "./youtube";
import { parseVtt } from "./vtt";
import { TranscriptDiagnostics, TranscriptResult } from "../types";
import {
  normalizeVideoMetadata,
  YtDlpVideoMetadataPayload,
} from "./ytdlp-metadata";
import { runYtDlpCommand, runYtDlpJsonCommand } from "./ytdlp-command";

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

async function fetchVideoMetadataWithYtDlp(
  options: FetchTranscriptWithYtDlpOptions,
  cookieBrowser: string,
): Promise<VideoMetadata | undefined> {
  const args = [
    options.ytDlpPath,
    "--skip-download",
    "--dump-single-json",
    "--cookies-from-browser",
    cookieBrowser,
    options.videoUrl,
  ];

  const stdout = await runYtDlpJsonCommand(args);
  return normalizeVideoMetadata(
    JSON.parse(stdout) as YtDlpVideoMetadataPayload,
  );
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
  const tempDir = mkdtempSync(path.join(tmpdir(), "youtube-transcribe-"));
  const outputTemplate = path.join(tempDir, "transcript");

  try {
    const languages = requestedLanguage
      ? `${requestedLanguage}.*,${requestedLanguage}`
      : "en.*,en";

    for (const playerClient of PLAYER_CLIENTS) {
      diagnostics.attemptedClients?.push(playerClient);
      try {
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
          args.push(
            "--extractor-args",
            `youtube:player_client=${playerClient}`,
          );
        }

        args.push(options.videoUrl);

        const commandResult = await runYtDlpCommand(args);
        diagnostics.stdoutSnippet = commandResult.stdoutSnippet;
        diagnostics.stderrSnippet = commandResult.stderrSnippet;

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
          let videoMetadata: VideoMetadata | undefined;
          try {
            videoMetadata = await fetchVideoMetadataWithYtDlp(
              options,
              cookieBrowser,
            );
          } catch {
            videoMetadata = undefined;
          }

          return {
            rawSegments,
            textOutput,
            jsonOutput: buildJsonOutput(rawSegments),
            segmentCount: rawSegments.length,
            requestedLanguage,
            effectiveLanguage,
            provider: "yt-dlp",
            diagnostics,
            videoMetadata,
          };
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown yt-dlp error";

        diagnostics.stderrSnippet = message;
        if (message.toLowerCase().includes("timed out")) {
          continue;
        }

        throw error;
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
    const commandResult = await runYtDlpCommand(fallbackArgs);
    diagnostics.stdoutSnippet = commandResult.stdoutSnippet;
    diagnostics.stderrSnippet = commandResult.stderrSnippet;

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
    let videoMetadata: VideoMetadata | undefined;
    try {
      videoMetadata = await fetchVideoMetadataWithYtDlp(options, cookieBrowser);
    } catch {
      videoMetadata = undefined;
    }

    return {
      rawSegments,
      textOutput,
      jsonOutput: buildJsonOutput(rawSegments),
      segmentCount: rawSegments.length,
      requestedLanguage,
      effectiveLanguage,
      provider: "yt-dlp",
      diagnostics,
      videoMetadata,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
