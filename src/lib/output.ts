import { HistoryEntry, OutputFormat, TranscriptSegment } from "../types";
import { formatTimestamp, groupSegmentsIntoBlocks } from "./transcript-text";

export { formatTimestamp } from "./transcript-text";

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

export type TranscriptParagraph = {
  startMs: number;
  text: string;
};

export function buildTranscriptParagraphs(
  rawSegments: TranscriptSegment[],
): TranscriptParagraph[] {
  return groupSegmentsIntoBlocks(rawSegments).map((block) => ({
    startMs: block.startMs,
    text: block.text,
  }));
}

export function buildReadableTextOutput(
  rawSegments: TranscriptSegment[],
): string {
  const paragraphs = buildTranscriptParagraphs(rawSegments);
  return paragraphs
    .map(
      (paragraph) =>
        `**${formatTimestamp(paragraph.startMs)}**\n${paragraph.text}`,
    )
    .join("\n\n")
    .trim();
}

export function materializeOutput(
  entry: HistoryEntry,
  format: OutputFormat,
): string {
  if (!entry.rawSegments?.length) {
    return entry.statusMessage ?? "";
  }

  return format === "json"
    ? buildJsonOutput(entry.rawSegments)
    : buildTextOutput(entry.rawSegments);
}

export function materializeDisplayOutput(
  entry: HistoryEntry,
  format: OutputFormat,
): string {
  if (!entry.rawSegments?.length) {
    return entry.statusMessage ?? "";
  }

  return format === "json"
    ? buildJsonOutput(entry.rawSegments)
    : buildReadableTextOutput(entry.rawSegments);
}
