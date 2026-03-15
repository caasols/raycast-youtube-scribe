import { materializeDisplayOutput } from "./output";
import type {
  HistoryEntry,
  OutputFormat,
  TranscriptErrorKind,
  YoutubeContentKind,
} from "../types";

export type HistoryDetailTitle = {
  level: 1;
  text: string;
};

export type HistoryDetailThumbnail = {
  alt: string;
  url: string;
};

export type HistoryDetailBody =
  | {
      kind: "transcript";
      markdown: string;
    }
  | {
      kind: "fetching";
      markdown: string;
    }
  | {
      kind: "debug-log";
      markdown: string;
    };

export type HistoryDetailViewModel = {
  title: HistoryDetailTitle;
  thumbnail: HistoryDetailThumbnail;
  primaryPills: string[];
  secondaryPills: string[];
  body: HistoryDetailBody;
};

export type HistoryDetailSurface = "history-pane" | "full-detail";

export type HistoryDetailRenderOptions = {
  surface?: HistoryDetailSurface;
};

const HISTORY_PANE_TITLE_MAX_CHARS = 32;
const FULL_DETAIL_TITLE_MAX_CHARS = 56;
const MAX_TAG_PILLS = 8;
type ParsedDebugStep = {
  step?: string;
  ok?: boolean;
  details?: Record<string, unknown>;
};

type ParsedDebugLog = {
  at?: string;
  phase?: string;
  source?: string;
  app?: string;
  resolvedUrl?: string;
  videoId?: string;
  requestedLanguage?: string;
  effectiveLanguage?: string;
  error?: string;
  friendlyError?: string;
  steps?: ParsedDebugStep[];
};

function fallbackThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

function statusText(entry: HistoryEntry): string {
  if (entry.status === "finished") return "Ready";
  if (entry.status === "fetching") return "Fetching";
  return "Failed";
}

function durationLabel(entry: HistoryEntry): string {
  const segments = entry.rawSegments ?? [];
  if (segments.length === 0) {
    return entry.videoMetadata?.durationText ?? "--:--";
  }

  const first = segments[0];
  const last = segments[segments.length - 1];
  const durationMs = Math.max(
    0,
    last.start_ms + last.duration_ms - first.start_ms,
  );
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function savedLabel(entry: HistoryEntry): string {
  return `Saved on ${new Date(entry.createdAt).toLocaleDateString()}`;
}

function titleMaxChars(surface: HistoryDetailSurface): number {
  return surface === "full-detail"
    ? FULL_DETAIL_TITLE_MAX_CHARS
    : HISTORY_PANE_TITLE_MAX_CHARS;
}

function detailTitle(
  entry: HistoryEntry,
  surface: HistoryDetailSurface,
): string {
  const title = entry.title || entry.videoId;
  const maxChars = titleMaxChars(surface);
  if (title.length <= maxChars) {
    return title;
  }

  return `${title.slice(0, maxChars - 3)}...`;
}

function detailThumbnail(entry: HistoryEntry): HistoryDetailThumbnail {
  return {
    alt: "",
    url:
      entry.videoMetadata?.thumbnailUrl ?? fallbackThumbnailUrl(entry.videoId),
  };
}

function contentKindLabel(kind?: YoutubeContentKind): string | undefined {
  switch (kind) {
    case "short":
      return "Short";
    case "live":
      return "Live";
    case "premiere":
      return "Premiere";
    default:
      return undefined;
  }
}

function primaryPills(entry: HistoryEntry): string[] {
  return [
    statusText(entry),
    contentKindLabel(entry.contentKind),
    entry.videoMetadata?.channelName,
    durationLabel(entry),
    entry.language ?? "auto",
    savedLabel(entry),
  ].filter((value): value is string => Boolean(value));
}

function secondaryPills(entry: HistoryEntry): string[] {
  return (entry.videoMetadata?.tags ?? []).slice(0, MAX_TAG_PILLS);
}

function humanizeStep(step?: string): string {
  if (!step) return "Unknown step";

  if (step === "manual-input") return "Checked manual input";
  if (step === "clipboard-scan") return "Scanned clipboard";
  if (step === "focused-tab") return "Detected focused tab";
  if (step === "transcript-fetch") return "Fetch transcript";
  if (step === "history-write-pending") return "Prepared history entry";
  if (step === "history-write-input-error") return "Recorded input error";

  const sentence = step.replace(/-/g, " ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function parseDebugLog(debugLog?: string): ParsedDebugLog | null {
  if (!debugLog) return null;

  try {
    return JSON.parse(debugLog) as ParsedDebugLog;
  } catch {
    return null;
  }
}

function requestContextLines(debug: ParsedDebugLog): string[] {
  return [
    debug.phase ? `- Phase: \`${debug.phase}\`` : undefined,
    debug.source ? `- Source: \`${debug.source}\`` : undefined,
    debug.app ? `- App: ${debug.app}` : undefined,
    debug.requestedLanguage
      ? `- Requested language: \`${debug.requestedLanguage}\``
      : undefined,
    debug.effectiveLanguage
      ? `- Effective language: \`${debug.effectiveLanguage}\``
      : undefined,
    debug.videoId ? `- Video ID: \`${debug.videoId}\`` : undefined,
    debug.resolvedUrl ? `- URL: ${debug.resolvedUrl}` : undefined,
    debug.at
      ? `- Captured at: ${new Date(debug.at).toLocaleString()}`
      : undefined,
  ].filter((line): line is string => Boolean(line));
}

function recoveryGuidance(
  errorKind: TranscriptErrorKind | undefined,
  summary: string,
): string[] {
  if (errorKind) {
    switch (errorKind) {
      case "timeout":
        return [
          "Retry the fetch in a few seconds.",
          "Keep Raycast open if you want to watch the result transition automatically.",
          "If this keeps happening, copy the debug log and inspect the yt-dlp details.",
        ];
      case "no-captions":
        return [
          "Open the video and confirm captions are actually available.",
          "Try a different language if the video has multiple caption tracks.",
        ];
      case "auth-required":
        return [
          "Open the video in your browser and confirm you have access to it.",
          "Check extension preferences for cookie settings.",
          "Retry the fetch after making sure the browser session is signed in.",
        ];
      case "private-or-deleted":
        return [
          "Open the video in your browser and confirm you have access to it.",
          "This video may have been removed or made private.",
        ];
      case "rate-limited":
        return [
          "YouTube is rate-limiting requests. Wait a moment and retry.",
          "If this keeps happening, try again later.",
        ];
      case "ytdlp-missing":
        return [
          "Install yt-dlp with `brew install yt-dlp` or `pipx install yt-dlp`.",
          "Restart Raycast after installing.",
        ];
      case "unknown":
        break; // Fall through to string-matching below
    }
  }

  // Fallback: string-match for entries without errorKind (pre-migration)
  const lower = summary.toLowerCase();

  if (lower.includes("timed out")) {
    return [
      "Retry the fetch in a few seconds.",
      "Keep Raycast open if you want to watch the result transition automatically.",
      "If this keeps happening, copy the debug log and inspect the yt-dlp details.",
    ];
  }

  if (lower.includes("no transcript") || lower.includes("no captions")) {
    return [
      "Open the video and confirm captions are actually available.",
      "Try a different language if the video has multiple caption tracks.",
    ];
  }

  if (
    lower.includes("sign in") ||
    lower.includes("cookies") ||
    lower.includes("private") ||
    lower.includes("restricted")
  ) {
    return [
      "Open the video in your browser and confirm you have access to it.",
      "Retry the fetch after making sure the browser session is signed in.",
    ];
  }

  return [
    "Retry the fetch.",
    "Open the video to confirm it is still available.",
    "If the problem persists, copy the debug log for deeper inspection.",
  ];
}

function renderStructuredDebugLog(
  debugLog: string | undefined,
  errorKind: TranscriptErrorKind | undefined,
): string {
  const parsed = parseDebugLog(debugLog);
  if (!parsed) {
    return `## Debug log\n\n${debugLog ?? "No debug data"}`;
  }

  const summary =
    parsed.friendlyError ??
    parsed.error ??
    "No high-level failure summary was recorded.";
  const requestContext = requestContextLines(parsed);
  const nextSteps = recoveryGuidance(errorKind, summary);
  const stepLines =
    parsed.steps?.map((step) => {
      const status = step.ok ? "Done" : "Failed";
      const details =
        step.details && Object.keys(step.details).length > 0
          ? `: ${Object.entries(step.details)
              .map(([key, value]) => `${key}: ${String(value)}`)
              .join(" | ")}`
          : "";
      return `- ${status}: ${humanizeStep(step.step)}${details}`;
    }) ?? [];

  const blocks = [
    "## What Happened",
    summary,
    stepLines.length > 0 ? `## What We Tried\n\n${stepLines.join("\n")}` : "",
    nextSteps.length > 0
      ? `## What You Can Do Next\n\n${nextSteps.map((step) => `- ${step}`).join("\n")}`
      : "",
    requestContext.length > 0
      ? `## Technical Details\n\n${requestContext.join("\n")}`
      : "",
  ].filter(Boolean);

  return blocks.join("\n\n");
}

function detailBody(
  entry: HistoryEntry,
  mode: OutputFormat,
): HistoryDetailBody {
  if (entry.status === "fetching") {
    return {
      kind: "fetching",
      markdown: "Still fetching transcript...",
    };
  }

  if (entry.status === "error") {
    return {
      kind: "debug-log",
      markdown: renderStructuredDebugLog(entry.debugLog, entry.errorKind),
    };
  }

  return {
    kind: "transcript",
    markdown: materializeDisplayOutput(entry, mode),
  };
}

function renderPills(pills: string[]): string {
  return pills.map((pill) => `\`${pill}\``).join(" ");
}

export function buildHistoryDetailViewModel(
  entry: HistoryEntry,
  mode: OutputFormat,
  options: HistoryDetailRenderOptions = {},
): HistoryDetailViewModel {
  const surface = options.surface ?? "history-pane";

  return {
    title: {
      level: 1,
      text: detailTitle(entry, surface),
    },
    thumbnail: detailThumbnail(entry),
    primaryPills: primaryPills(entry),
    secondaryPills: secondaryPills(entry),
    body: detailBody(entry, mode),
  };
}

export function renderHistoryDetailMarkdown(
  viewModel: HistoryDetailViewModel,
): string {
  const blocks = [
    `${"#".repeat(viewModel.title.level)} ${viewModel.title.text}`,
    "---",
    `![${viewModel.thumbnail.alt}](${viewModel.thumbnail.url})`,
    "---",
    viewModel.primaryPills.length > 0
      ? renderPills(viewModel.primaryPills)
      : "",
    viewModel.secondaryPills.length > 0
      ? renderPills(viewModel.secondaryPills)
      : "",
    viewModel.body.markdown,
  ].filter(Boolean);

  return `${blocks.join("\n\n")}\n`;
}

export function buildHistoryDetailMarkdown(
  entry: HistoryEntry,
  mode: OutputFormat,
  options: HistoryDetailRenderOptions = {},
): string {
  return renderHistoryDetailMarkdown(
    buildHistoryDetailViewModel(entry, mode, options),
  );
}
