import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExportFormat, HistoryEntry, TranscriptSegment } from "../types";
import {
  buildJsonOutput,
  buildTextOutput,
  buildTranscriptParagraphs,
  formatTimestamp,
} from "./output";

export function sanitizeFilename(title: string): string {
  // Replace unsafe characters with hyphens (keep alphanumeric, hyphens, underscores, spaces, periods)
  let result = title.replace(/[^a-zA-Z0-9\-_\s.]/g, "-");

  // Collapse consecutive hyphens
  result = result.replace(/-+/g, "-");

  // Trim leading/trailing hyphens and spaces
  result = result.replace(/^[-\s]+|[-\s]+$/g, "");

  // Truncate to 80 chars at word boundary
  if (result.length > 80) {
    const truncated = result.slice(0, 80);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 40) {
      result = truncated.slice(0, lastSpace);
    } else {
      result = truncated;
    }
    // Trim trailing hyphens/spaces after truncation
    result = result.replace(/[-\s]+$/, "");
  }

  // Fall back to "transcript" if empty
  return result || "transcript";
}

export function buildPlainReadableOutput(
  rawSegments: TranscriptSegment[],
): string {
  if (rawSegments.length === 0) return "";

  const paragraphs = buildTranscriptParagraphs(rawSegments);
  return paragraphs
    .map(
      (paragraph) =>
        `[${formatTimestamp(paragraph.startMs)}]\n${paragraph.text}`,
    )
    .join("\n\n")
    .trim();
}

function formatSrtTimestamp(ms: number): string {
  const totalMs = Math.max(0, ms);
  const hours = Math.floor(totalMs / 3_600_000)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor((totalMs % 60_000) / 1_000)
    .toString()
    .padStart(2, "0");
  const millis = (totalMs % 1_000).toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds},${millis}`;
}

export function buildSrtOutput(rawSegments: TranscriptSegment[]): string {
  if (rawSegments.length === 0) return "";

  return rawSegments
    .map((segment, index) => {
      const startTs = formatSrtTimestamp(segment.start_ms);
      const endTs = formatSrtTimestamp(segment.start_ms + segment.duration_ms);
      return `${index + 1}\n${startTs} --> ${endTs}\n${segment.text.trim()}`;
    })
    .join("\n\n");
}

export function exportTranscript(
  entry: HistoryEntry,
  format: ExportFormat,
): string {
  if (!entry.rawSegments?.length) return "";

  switch (format) {
    case "plain":
      return buildTextOutput(entry.rawSegments);
    case "readable":
      return buildPlainReadableOutput(entry.rawSegments);
    case "json":
      return buildJsonOutput(entry.rawSegments);
    case "srt":
      return buildSrtOutput(entry.rawSegments);
  }
}

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  plain: ".txt",
  readable: "-readable.txt",
  json: ".json",
  srt: ".srt",
};

export function buildExportFilename(
  entry: HistoryEntry,
  format: ExportFormat,
): string {
  const sanitized = sanitizeFilename(entry.title);
  const ext = FORMAT_EXTENSIONS[format];
  return `${sanitized}${ext}`;
}

export async function saveToDownloads(
  filename: string,
  content: string,
): Promise<string> {
  const fullPath = join(homedir(), "Downloads", filename);
  await writeFile(fullPath, content, "utf8");
  return fullPath;
}
