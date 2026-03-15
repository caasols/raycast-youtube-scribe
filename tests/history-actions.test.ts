import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SUMMARIZE_PROMPT_TEMPLATE,
  buildSuggestedTranscriptQuestions,
  buildTranscriptQuestionPrompt,
  buildTranscriptSummaryPrompt,
  updateRecentTranscriptQuestions,
} from "../src/commands/transcript-history/transcript-ai";
import type { HistoryEntry } from "../src/types";

const baseEntry: HistoryEntry = {
  id: "entry-1",
  fetchKey: "abc::auto",
  createdAt: "2026-03-15T10:00:00.000Z",
  videoId: "abc",
  url: "https://www.youtube.com/watch?v=abc",
  title: "Video",
  segmentCount: 1,
  rawSegments: [{ text: "hello world", start_ms: 0, duration_ms: 1000 }],
  status: "finished",
};

describe("history actions", () => {
  it("builds a dedicated summarize prompt for in-extension AI summaries", () => {
    expect(
      buildTranscriptSummaryPrompt(
        baseEntry,
        DEFAULT_SUMMARIZE_PROMPT_TEMPLATE,
      ),
    ).toContain(
      "You are creating a concise, structured summary of a YouTube video based only on its transcript.",
    );
    expect(
      buildTranscriptSummaryPrompt(
        baseEntry,
        DEFAULT_SUMMARIZE_PROMPT_TEMPLATE,
      ),
    ).toContain("Transcript:\nhello world");
    expect(
      buildTranscriptSummaryPrompt(
        baseEntry,
        DEFAULT_SUMMARIZE_PROMPT_TEMPLATE,
      ),
    ).toContain(`URL: ${baseEntry.url}`);
    expect(
      buildTranscriptSummaryPrompt(
        baseEntry,
        DEFAULT_SUMMARIZE_PROMPT_TEMPLATE,
      ),
    ).toContain("### Analogy");
  });

  it("builds a dedicated ask prompt for in-extension transcript questions", () => {
    expect(
      buildTranscriptQuestionPrompt(baseEntry, "What tools were mentioned?"),
    ).toContain("Question: What tools were mentioned?");
    expect(
      buildTranscriptQuestionPrompt(baseEntry, "What tools were mentioned?"),
    ).toContain("Transcript:\nhello world");
  });

  it("builds suggested transcript questions for the quick-ai style screen", () => {
    expect(buildSuggestedTranscriptQuestions(baseEntry)).toEqual([
      'What are the main ideas in "Video"?',
      'What action items or next steps are mentioned in "Video"?',
      'Which tools, products, or people are mentioned in "Video"?',
      'Give me the most important takeaways from "Video".',
    ]);
  });

  it("stores recent questions with dedupe and recency ordering", () => {
    expect(
      updateRecentTranscriptQuestions(
        ["What is this about?", "Who is mentioned?"],
        "Who is mentioned?",
      ),
    ).toEqual(["Who is mentioned?", "What is this about?"]);
  });

  it("stores retry payload and launches the transcription command", async () => {
    const setLocalStorageItem = vi.fn();
    const launchCommand = vi.fn();

    const { retryFetch } =
      await import("../src/commands/transcript-history/history-actions");

    await retryFetch(baseEntry, {
      setLocalStorageItem,
      launchCommand,
      clearFocusedEntry: vi.fn(),
    });

    expect(setLocalStorageItem).toHaveBeenCalledWith(
      "transcript-retry-intent",
      JSON.stringify({
        type: "retry-transcript",
        url: baseEntry.url,
        language: undefined,
      }),
    );
    expect(launchCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "get-youtube-transcript",
      }),
    );
  });
});
