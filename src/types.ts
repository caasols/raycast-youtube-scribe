export type OutputFormat = "text" | "json";

export type TranscriptStatus = "fetching" | "finished" | "error";

export type HistoryEntry = {
  id: string;
  createdAt: string;
  videoId: string;
  url: string;
  title: string;
  language?: string;
  format: OutputFormat;
  segmentCount: number;
  output: string;
  status: TranscriptStatus;
  errorLog?: string;
};
