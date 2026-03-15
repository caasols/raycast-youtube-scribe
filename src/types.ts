export type OutputFormat = "text" | "json";
export type ExportFormat = "plain" | "readable" | "json" | "srt";

export type TranscriptStatus = "fetching" | "finished" | "error";

export type TranscriptSegment = {
  text: string;
  start_ms: number;
  duration_ms: number;
};

export type TranscriptProvider = "yt-dlp";
export type YoutubeContentKind = "video" | "short" | "live" | "premiere";

export type TranscriptErrorKind =
  | "timeout"
  | "no-captions"
  | "auth-required"
  | "private-or-deleted"
  | "rate-limited"
  | "ytdlp-missing"
  | "unknown";

export type VideoMetadata = {
  title?: string;
  channelName?: string;
  creatorHandle?: string;
  creatorUrl?: string;
  channelId?: string;
  channelUrl?: string;
  uploadDate?: string;
  durationSeconds?: number;
  durationText?: string;
  thumbnailUrl?: string;
  description?: string;
  tags?: string[];
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  channelVerified?: boolean;
  liveStatus?: string;
};

export type TranscriptDiagnostics = {
  ytDlpPath?: string;
  ytDlpSource?: string;
  browserApp?: string;
  cookieBrowser?: string;
  requestedLanguage?: string;
  effectiveLanguage?: string;
  attemptedClients?: string[];
  subtitleFiles?: string[];
  stdoutSnippet?: string;
  stderrSnippet?: string;
};

export type TranscriptResult = {
  rawSegments: TranscriptSegment[];
  textOutput: string;
  jsonOutput: string;
  segmentCount: number;
  requestedLanguage: string;
  effectiveLanguage: string;
  provider: TranscriptProvider;
  diagnostics: TranscriptDiagnostics;
  videoMetadata?: VideoMetadata;
};

export type HistoryEntry = {
  id: string;
  fetchKey: string;
  createdAt: string;
  videoId: string;
  url: string;
  contentKind?: YoutubeContentKind;
  title: string;
  language?: string;
  segmentCount: number;
  rawSegments?: TranscriptSegment[];
  status: TranscriptStatus;
  statusMessage?: string;
  errorLog?: string;
  errorKind?: TranscriptErrorKind;
  debugLog?: string;
  provider?: TranscriptProvider;
  diagnostics?: TranscriptDiagnostics;
  videoMetadata?: VideoMetadata;
  backgroundCompletedAt?: string;
  aiSummary?: string;
};
