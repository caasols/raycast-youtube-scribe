import { TranscriptSegment } from "../types";

function timestampToMs(input: string): number {
  const match = input.trim().match(/(?:(\d+):)?(\d+):(\d+)[.,](\d+)/);
  if (!match) return 0;

  const hours = Number(match[1] ?? "0");
  const minutes = Number(match[2] ?? "0");
  const seconds = Number(match[3] ?? "0");
  const millis = Number(match[4] ?? "0");

  return (hours * 3600 + minutes * 60 + seconds) * 1000 + millis;
}

export function parseVtt(vtt: string): TranscriptSegment[] {
  const blocks = vtt.trim().split(/\n{2,}/);
  const seen = new Set<string>();
  const transcript: TranscriptSegment[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const cueIndex = lines.findIndex((line) =>
      /^\d{2,}:\d{2}:\d{2}[.,]\d{3}\s+-->\s+\d{2,}:\d{2}:\d{2}[.,]\d{3}/.test(
        line,
      ),
    );
    if (cueIndex === -1) continue;

    const [startRaw, endRawWithRest] = lines[cueIndex].split(/\s+-->\s+/);
    if (!startRaw || !endRawWithRest) continue;

    const endRaw = endRawWithRest.split(/\s+/)[0];
    const text = lines
      .slice(cueIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!text || seen.has(text)) continue;
    seen.add(text);

    const start_ms = timestampToMs(startRaw);
    const end_ms = timestampToMs(endRaw);

    transcript.push({
      text,
      start_ms,
      duration_ms: Math.max(0, end_ms - start_ms),
    });
  }

  return transcript;
}
