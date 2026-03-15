import { materializeOutput } from "./output";
import { HistoryEntry, OutputFormat } from "../types";

export type HistoryDetailMetadataItem = {
  label: string;
  value: string;
};

function statusText(entry: HistoryEntry): string {
  if (entry.status === "finished") return "Ready";
  if (entry.status === "fetching") return "Fetching";
  return "Failed";
}

function durationLabel(entry: HistoryEntry): string {
  const segments = entry.rawSegments ?? [];
  if (segments.length === 0) return "--:--";

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

export function buildHistoryDetailMetadata(
  entry: HistoryEntry,
  mode: OutputFormat,
): HistoryDetailMetadataItem[] {
  return [
    { label: "Status", value: statusText(entry) },
    { label: "Language", value: entry.language ?? "auto" },
    { label: "Duration", value: durationLabel(entry) },
    { label: "Segments", value: String(entry.segmentCount) },
    { label: "Provider", value: entry.provider ?? "yt-dlp" },
    { label: "View", value: mode.toUpperCase() },
    { label: "Saved", value: new Date(entry.createdAt).toLocaleString() },
    { label: "URL", value: entry.url },
  ];
}

export function buildHistoryDetailMarkdown(
  entry: HistoryEntry,
  mode: OutputFormat,
): string {
  if (entry.status === "fetching") {
    return `# ${entry.title}\n\n## Processing\nStill fetching transcript...\n\n## Debug log\n\n\
\
\
${entry.debugLog ?? "No debug data"}\n\
\
\
`;
  }

  if (entry.status === "error") {
    return `# ${entry.title}\n\n## Error log\n\n\
\
\
${entry.errorLog ?? "Unknown error"}\n\
\
\
\n## Debug log\n\n\
\
\
${entry.debugLog ?? "No debug data"}\n\
\
\
`;
  }

  const output = materializeOutput(entry, mode);
  return `# ${entry.title}\n\n## Transcript\n\n\
\
\
${output}\n\
\
\
`;
}
