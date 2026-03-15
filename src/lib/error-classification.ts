import type { TranscriptErrorKind } from "../types";

export function classifyTranscriptError(raw: string): TranscriptErrorKind {
  const lower = raw.toLowerCase();

  if (lower.includes("yt-dlp is not installed")) return "ytdlp-missing";
  if (lower.includes("no captions found")) return "no-captions";
  if (lower.includes("sign in") || lower.includes("cookies"))
    return "auth-required";
  if (lower.includes("private") || lower.includes("video unavailable"))
    return "private-or-deleted";
  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("http error 429")
  )
    return "rate-limited";
  if (lower.includes("timed out")) return "timeout";

  return "unknown";
}

export function formatTranscriptError(kind: TranscriptErrorKind): string {
  switch (kind) {
    case "timeout":
      return "yt-dlp timed out while fetching captions. Please retry. If it keeps happening, open the debug log from history.";
    case "no-captions":
      return "No transcript track is available for this video.";
    case "auth-required":
      return "This video requires browser cookies or sign-in access to fetch captions.";
    case "private-or-deleted":
      return "This video is unavailable (private, removed, or restricted).";
    case "rate-limited":
      return "YouTube is rate-limiting transcript requests right now. Please try again in a moment.";
    case "ytdlp-missing":
      return "yt-dlp is not installed. Install it with `brew install yt-dlp` or `pipx install yt-dlp`, then try again.";
    case "unknown":
      return "Failed to fetch transcript.";
  }
}

export function isRetryable(kind: TranscriptErrorKind): boolean {
  switch (kind) {
    case "timeout":
    case "rate-limited":
    case "auth-required":
    case "unknown":
      return true;
    case "no-captions":
    case "private-or-deleted":
    case "ytdlp-missing":
      return false;
  }
}
