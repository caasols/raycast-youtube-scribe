import { HistoryEntry, OutputFormat, TranscriptSegment } from "../types";

export function buildTextOutput(rawSegments: TranscriptSegment[]): string {
  return rawSegments
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildJsonOutput(rawSegments: TranscriptSegment[]): string {
  return JSON.stringify(rawSegments, null, 2);
}

export function materializeOutput(
  entry: HistoryEntry,
  format: OutputFormat,
): string {
  if (!entry.rawSegments?.length) {
    return entry.output;
  }

  return format === "json"
    ? buildJsonOutput(entry.rawSegments)
    : buildTextOutput(entry.rawSegments);
}
