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
  videoUrl?: string,
): string {
  const paragraphs = buildTranscriptParagraphs(rawSegments);
  return paragraphs
    .map((paragraph) => {
      const ts = formatTimestamp(paragraph.startMs);
      const seconds = Math.floor(paragraph.startMs / 1000);
      const timestamp = videoUrl
        ? `[**${ts}**](${videoUrl}&t=${seconds})`
        : `**${ts}**`;
      return `${timestamp}\n${paragraph.text}`;
    })
    .join("\n\n")
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildRichTextHtml(entry: HistoryEntry): string {
  const parts: string[] = [];
  const title = entry.title || entry.videoId;

  parts.push(`<h1>${escapeHtml(title)}</h1>`);

  const meta: string[] = [];
  if (entry.videoMetadata?.channelName) meta.push(`<b>Channel:</b> ${escapeHtml(entry.videoMetadata.channelName)}`);
  meta.push(`<b>URL:</b> <a href="${escapeHtml(entry.url)}">${escapeHtml(entry.url)}</a>`);
  if (entry.videoMetadata?.durationText) meta.push(`<b>Duration:</b> ${escapeHtml(entry.videoMetadata.durationText)}`);
  if (entry.language) meta.push(`<b>Language:</b> ${escapeHtml(entry.language)}`);
  if (meta.length) parts.push(`<p>${meta.join("<br>")}</p>`);

  if (entry.aiSummaries?.[0]) {
    parts.push(`<h2>Summary</h2>`);
    parts.push(`<p>${escapeHtml(entry.aiSummaries[0].content).replace(/\n/g, "<br>")}</p>`);
  }

  parts.push(`<h2>Transcript</h2>`);
  if (entry.rawSegments?.length) {
    const paragraphs = buildTranscriptParagraphs(entry.rawSegments);
    for (const p of paragraphs) {
      const ts = formatTimestamp(p.startMs);
      const seconds = Math.floor(p.startMs / 1000);
      const tsLink = `<a href="${escapeHtml(entry.url)}&t=${seconds}"><b>${ts}</b></a>`;
      parts.push(`<p>${tsLink}<br>${escapeHtml(p.text)}</p>`);
    }
  }

  return parts.join("\n");
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
  videoUrl?: string,
): string {
  if (!entry.rawSegments?.length) {
    return entry.statusMessage ?? "";
  }

  return format === "json"
    ? buildJsonOutput(entry.rawSegments)
    : buildReadableTextOutput(entry.rawSegments, videoUrl);
}
