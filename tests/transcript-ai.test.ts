import { describe, expect, it } from "vitest";
import {
  buildTranscriptSummaryPrompt,
  buildTranscriptQuestionPrompt,
  DEFAULT_SUMMARIZE_PROMPT_TEMPLATE,
} from "../src/commands/transcript-history/transcript-ai";
import type { HistoryEntry } from "../src/types";

const entryWithMetadata: HistoryEntry = {
  id: "test-1",
  fetchKey: "key-1",
  createdAt: "2026-01-01T00:00:00Z",
  videoId: "abc123",
  url: "https://youtube.com/watch?v=abc123",
  title: "Test Video",
  segmentCount: 1,
  rawSegments: [{ text: "Hello world.", start_ms: 0, duration_ms: 1000 }],
  status: "finished",
  contentKind: "short",
  language: "en",
  videoMetadata: {
    channelName: "Test Channel",
    durationText: "5:30",
    tags: ["coding", "tutorial"],
  },
};

const entryWithoutMetadata: HistoryEntry = {
  id: "test-2",
  fetchKey: "key-2",
  createdAt: "2026-01-01T00:00:00Z",
  videoId: "def456",
  url: "https://youtube.com/watch?v=def456",
  title: "Bare Video",
  segmentCount: 1,
  rawSegments: [{ text: "Some text.", start_ms: 0, duration_ms: 1000 }],
  status: "finished",
};

describe("DEFAULT_SUMMARIZE_PROMPT_TEMPLATE", () => {
  it("contains metadata placeholders", () => {
    expect(DEFAULT_SUMMARIZE_PROMPT_TEMPLATE).toContain("{{channel}}");
    expect(DEFAULT_SUMMARIZE_PROMPT_TEMPLATE).toContain("{{contentKind}}");
    expect(DEFAULT_SUMMARIZE_PROMPT_TEMPLATE).toContain("{{language}}");
    expect(DEFAULT_SUMMARIZE_PROMPT_TEMPLATE).toContain("{{tags}}");
    expect(DEFAULT_SUMMARIZE_PROMPT_TEMPLATE).toContain("{{duration}}");
  });
});

describe("buildTranscriptSummaryPrompt", () => {
  it("interpolates metadata when available", () => {
    const prompt = buildTranscriptSummaryPrompt(
      entryWithMetadata,
      DEFAULT_SUMMARIZE_PROMPT_TEMPLATE,
    );
    expect(prompt).toContain("Channel: Test Channel");
    expect(prompt).toContain("Type: short");
    expect(prompt).toContain("Duration: 5:30");
    expect(prompt).toContain("Language: en");
    expect(prompt).toContain("Tags: coding, tutorial");
  });

  it("uses fallbacks when metadata is missing", () => {
    const prompt = buildTranscriptSummaryPrompt(
      entryWithoutMetadata,
      DEFAULT_SUMMARIZE_PROMPT_TEMPLATE,
    );
    expect(prompt).toContain("Channel: Unknown");
    expect(prompt).toContain("Type: video");
    expect(prompt).toContain("Duration: Unknown");
    expect(prompt).toContain("Language: Unknown");
    expect(prompt).toContain("Tags: None");
  });
});

describe("buildTranscriptQuestionPrompt", () => {
  it("includes metadata in question prompt", () => {
    const prompt = buildTranscriptQuestionPrompt(
      entryWithMetadata,
      "What is this about?",
    );
    expect(prompt).toContain("Channel: Test Channel");
    expect(prompt).toContain("Type: short");
    expect(prompt).toContain("Tags: coding, tutorial");
  });

  it("uses fallbacks in question prompt", () => {
    const prompt = buildTranscriptQuestionPrompt(
      entryWithoutMetadata,
      "What is this about?",
    );
    expect(prompt).toContain("Channel: Unknown");
    expect(prompt).toContain("Tags: None");
  });
});
