import { materializeOutput } from "./output";
import { HistoryEntry, OutputFormat } from "../types";

function statusText(entry: HistoryEntry): string {
  if (entry.status === "finished") return "Ready";
  if (entry.status === "fetching") return "Fetching";
  return "Failed";
}

export function buildHistoryDetailMarkdown(
  entry: HistoryEntry,
  mode: OutputFormat,
): string {
  const metadata = [
    `- **Status:** ${statusText(entry)}`,
    `- **Language:** ${entry.language ?? "auto"}`,
    `- **Provider:** ${entry.provider ?? "yt-dlp"}`,
    `- **Segments:** ${entry.segmentCount}`,
    `- **Saved:** ${new Date(entry.createdAt).toLocaleString()}`,
    `- **View mode:** ${mode.toUpperCase()}`,
    `- **URL:** ${entry.url}`,
  ].join("\n");

  if (entry.status === "fetching") {
    return `# ${entry.title}\n\n${metadata}\n\n---\n\n## Processing\nStill fetching transcript...\n\n## Debug log\n\n\
\
\
${entry.debugLog ?? "No debug data"}\n\
\
\
`;
  }

  if (entry.status === "error") {
    return `# ${entry.title}\n\n${metadata}\n\n---\n\n## Error log\n\n\
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
  return `# ${entry.title}\n\n${metadata}\n\n---\n\n## Transcript\n\n\
\
\
${output}\n\
\
\
`;
}
