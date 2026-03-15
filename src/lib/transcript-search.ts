import type { TranscriptSegment } from "../types";
import { groupSegmentsIntoBlocks } from "./transcript-text";

const DEFAULT_TRANSCRIPT_SEARCH_LIMIT = 200;

export type TranscriptChunk = {
  id: string;
  start_ms: number;
  duration_ms: number;
  text: string;
};

export { formatTimestamp as formatTranscriptTimestamp } from "./transcript-text";

export function buildTranscriptChunks(
  segments: TranscriptSegment[],
): TranscriptChunk[] {
  return groupSegmentsIntoBlocks(segments).map((block) => ({
    id: `${block.startMs}-${block.endMs}`,
    start_ms: block.startMs,
    duration_ms: Math.max(0, block.endMs - block.startMs),
    text: block.text,
  }));
}

export function fuzzyTranscriptMatch(text: string, query: string): boolean {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, " ");
  const condensedText = normalizedText.replace(/\s+/g, " ");
  if (!normalizedQuery) return true;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);

  return queryTokens.every((token) => {
    if (normalizedText.includes(token)) {
      return true;
    }

    if (token.length >= 4) {
      return false;
    }

    let index = 0;
    for (const character of token) {
      index = condensedText.indexOf(character, index);
      if (index === -1) return false;
      index += 1;
    }

    return true;
  });
}

export function findTranscriptSearchMatches(
  chunks: TranscriptChunk[],
  query: string,
): TranscriptChunk[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return chunks.slice(0, DEFAULT_TRANSCRIPT_SEARCH_LIMIT);
  }

  return chunks.filter((chunk) =>
    fuzzyTranscriptMatch(chunk.text, normalizedQuery),
  );
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1");
}

export function highlightTranscriptText(text: string, query: string): string {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 2);

  if (tokens.length === 0) {
    return escapeMarkdown(text);
  }

  const ranges: Array<{ start: number; end: number }> = [];
  const lowerText = text.toLowerCase();

  for (const token of tokens) {
    let startIndex = 0;
    while (startIndex < lowerText.length) {
      const foundAt = lowerText.indexOf(token, startIndex);
      if (foundAt === -1) break;
      ranges.push({ start: foundAt, end: foundAt + token.length });
      startIndex = foundAt + token.length;
    }
  }

  if (ranges.length === 0) {
    return escapeMarkdown(text);
  }

  ranges.sort((left, right) => left.start - right.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      continue;
    }

    previous.end = Math.max(previous.end, range.end);
  }

  let cursor = 0;
  let highlighted = "";
  for (const range of merged) {
    highlighted += escapeMarkdown(text.slice(cursor, range.start));
    highlighted += `**${escapeMarkdown(text.slice(range.start, range.end))}**`;
    cursor = range.end;
  }
  highlighted += escapeMarkdown(text.slice(cursor));
  return highlighted;
}

export function buildTranscriptSearchSnippet(
  text: string,
  query: string,
  maxLength = 96,
): string {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  const lowerText = normalizedText.toLowerCase();
  const firstMatchIndex = tokens.reduce((best, token) => {
    const matchIndex = lowerText.indexOf(token);
    if (matchIndex === -1) return best;
    if (best === -1) return matchIndex;
    return Math.min(best, matchIndex);
  }, -1);

  const start = Math.max(
    0,
    firstMatchIndex === -1
      ? 0
      : firstMatchIndex - Math.floor((maxLength - 12) / 3),
  );
  const end = Math.min(normalizedText.length, start + maxLength);
  const visible = normalizedText.slice(start, end).trim();

  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedText.length ? "..." : "";
  return `${prefix}${visible}${suffix}`;
}

export function buildTranscriptSearchContext(
  text: string,
  query: string,
  maxLength = 160,
): string {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  const lowerText = normalizedText.toLowerCase();
  const firstMatchIndex = tokens.reduce((best, token) => {
    const matchIndex = lowerText.indexOf(token);
    if (matchIndex === -1) return best;
    if (best === -1) return matchIndex;
    return Math.min(best, matchIndex);
  }, -1);

  const start = Math.max(
    0,
    firstMatchIndex === -1
      ? 0
      : firstMatchIndex - Math.floor((maxLength - 24) / 2),
  );
  const end = Math.min(normalizedText.length, start + maxLength);
  const visible = normalizedText.slice(start, end).trim();

  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedText.length ? "..." : "";
  return `${prefix}${visible}${suffix}`;
}
