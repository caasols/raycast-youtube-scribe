import type { TranscriptSegment } from "../types";

export function normalizeSegmentText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const CHUNK_GAP_MS = 1500;
const CHUNK_BREAK_CHAR_TARGET = 280;
const CHUNK_CHAR_TARGET = 360;

export type SegmentBlock = {
  startMs: number;
  endMs: number;
  text: string;
};

export function groupSegmentsIntoBlocks(
  segments: TranscriptSegment[],
): SegmentBlock[] {
  const blocks: SegmentBlock[] = [];
  let currentTexts: string[] = [];
  let currentStartMs = 0;
  let currentEndMs = 0;
  let currentLength = 0;
  let previousSegment: TranscriptSegment | undefined;

  function flush() {
    if (currentTexts.length === 0) return;
    blocks.push({
      startMs: currentStartMs,
      endMs: currentEndMs,
      text: currentTexts.join(" ").replace(/\s+/g, " ").trim(),
    });
    currentTexts = [];
    currentLength = 0;
  }

  for (const segment of segments) {
    const normalizedText = normalizeSegmentText(segment.text);
    if (!normalizedText) continue;

    if (currentTexts.length === 0) {
      currentStartMs = segment.start_ms;
      currentEndMs = segment.start_ms + segment.duration_ms;
    } else if (previousSegment) {
      const previousEndMs =
        previousSegment.start_ms + previousSegment.duration_ms;
      const gapMs = segment.start_ms - previousEndMs;
      const previousText = currentTexts[currentTexts.length - 1] ?? "";
      const shouldBreakForGap = gapMs >= CHUNK_GAP_MS;
      const shouldBreakForLength =
        currentLength >= CHUNK_BREAK_CHAR_TARGET &&
        /[.!?]["']?$/.test(previousText);
      const wouldOverflow =
        currentLength + normalizedText.length + 1 > CHUNK_CHAR_TARGET;

      if (shouldBreakForGap || shouldBreakForLength || wouldOverflow) {
        flush();
        currentStartMs = segment.start_ms;
      }

      currentEndMs = segment.start_ms + segment.duration_ms;
    }

    currentTexts.push(normalizedText);
    currentLength += normalizedText.length + 1;
    previousSegment = segment;
  }

  flush();
  return blocks;
}
