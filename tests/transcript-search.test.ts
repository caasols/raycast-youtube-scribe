import { describe, expect, it } from "vitest";
import {
  buildTranscriptSearchContext,
  buildTranscriptSearchSnippet,
  buildTranscriptChunks,
  fuzzyTranscriptMatch,
  findTranscriptSearchMatches,
  formatTranscriptTimestamp,
  highlightTranscriptText,
} from "../src/lib/transcript-search";
import type { TranscriptSegment } from "../src/types";

const segments: TranscriptSegment[] = [
  { text: "hello world", start_ms: 0, duration_ms: 1200 },
  { text: "help me understand", start_ms: 1200, duration_ms: 900 },
  { text: "goodbye world", start_ms: 2100, duration_ms: 1500 },
];

describe("fuzzyTranscriptMatch", () => {
  it("matches fuzzy characters in order", () => {
    expect(fuzzyTranscriptMatch("hello world", "hwd")).toBe(true);
    expect(fuzzyTranscriptMatch("hello world", "hlw")).toBe(true);
    expect(fuzzyTranscriptMatch("smart televisions", "stv")).toBe(true);
  });

  it("rejects characters that do not appear in order", () => {
    expect(fuzzyTranscriptMatch("hello world", "whd")).toBe(false);
    expect(fuzzyTranscriptMatch("hello world", "zzz")).toBe(false);
    expect(
      fuzzyTranscriptMatch(
        "smart tvs still suck use this instead",
        "wordthatdoesntexist",
      ),
    ).toBe(false);
    expect(
      fuzzyTranscriptMatch(
        "smart tvs still suck use this instead",
        "television",
      ),
    ).toBe(false);
  });
});

describe("findTranscriptSearchMatches", () => {
  it("returns the first 200 chunks when query is empty", () => {
    const manySegments = Array.from({ length: 250 }, (_, index) => ({
      text: `segment ${index}`,
      start_ms: index * 3000,
      duration_ms: 1000,
    }));
    const chunks = buildTranscriptChunks(manySegments);

    const matches = findTranscriptSearchMatches(chunks, "");

    expect(matches).toHaveLength(200);
    expect(matches[0]?.text).toBe("segment 0");
    expect(matches.at(-1)?.text).toBe("segment 199");
  });

  it("filters chunks using fuzzy matching while preserving timeline order", () => {
    const chunks = buildTranscriptChunks([
      { text: "hello world", start_ms: 0, duration_ms: 1200 },
      { text: "help me understand", start_ms: 5000, duration_ms: 900 },
      { text: "goodbye world", start_ms: 9000, duration_ms: 1500 },
    ]);
    const matches = findTranscriptSearchMatches(chunks, "hmu");

    expect(matches.map((match) => match.text)).toEqual(["help me understand"]);
  });
});

describe("buildTranscriptChunks", () => {
  it("keeps transcript chunks ordered by time", () => {
    const chunks = buildTranscriptChunks([
      { text: "first", start_ms: 0, duration_ms: 1000 },
      { text: "second", start_ms: 1200, duration_ms: 1000 },
      { text: "third", start_ms: 4000, duration_ms: 1000 },
    ]);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.text).toBe("first second");
    expect(chunks[1]?.text).toBe("third");
  });
});

describe("transcript search helpers", () => {
  it("formats timestamps for chunk accessories", () => {
    expect(formatTranscriptTimestamp(0)).toBe("00:00");
    expect(formatTranscriptTimestamp(65_000)).toBe("01:05");
  });

  it("highlights exact token matches without reordering text", () => {
    expect(highlightTranscriptText("hello world", "world")).toBe(
      "hello **world**",
    );
    expect(highlightTranscriptText("hello world", "zzz")).toBe("hello world");
  });

  it("builds a compact snippet around the first query hit", () => {
    const snippet = buildTranscriptSearchSnippet(
      "Every developer in 2026 has the same problem. You open your editor and start building.",
      "editor",
      40,
    );

    expect(snippet).toContain("editor");
    expect(snippet.length).toBeLessThanOrEqual(46);
  });

  it("builds a longer context line around the first query hit", () => {
    const context = buildTranscriptSearchContext(
      "Every developer in 2026 has the same problem. You open your editor and start building.",
      "editor",
      60,
    );

    expect(context).toContain("editor");
    expect(context.length).toBeLessThanOrEqual(66);
  });
});
