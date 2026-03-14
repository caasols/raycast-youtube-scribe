export type OutputFormat = "text" | "json";

export type TranscriptStatus = "fetching" | "finished" | "error";

export type TranscriptSegment = {
  text: string;
  start_ms: number;
  duration_ms: number;
};

export type TranscriptProvider = "yt-dlp";

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
};

export type HistoryEntry = {
  id: string;
  fetchKey: string;
  createdAt: string;
  videoId: string;
  url: string;
  title: string;
  language?: string;
  format: OutputFormat;
  segmentCount: number;
  output: string;
  rawSegments?: TranscriptSegment[];
  status: TranscriptStatus;
  errorLog?: string;
  debugLog?: string;
  provider?: TranscriptProvider;
  diagnostics?: TranscriptDiagnostics;
};
