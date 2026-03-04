export type OutputFormat = "text" | "json";

export type HistoryEntry = {
  id: string;
  createdAt: string;
  videoId: string;
  url: string;
  language?: string;
  format: OutputFormat;
  segmentCount: number;
  output: string;
};
