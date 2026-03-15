import { materializeOutput } from "../../lib/output";
import { DEFAULT_SUMMARIZE_PROMPT_TEMPLATE } from "../../lib/prompt-templates";
import type { HistoryEntry } from "../../types";

export { DEFAULT_SUMMARIZE_PROMPT_TEMPLATE } from "../../lib/prompt-templates";

function interpolateTemplate(
  template: string,
  entry: HistoryEntry,
  transcript: string,
): string {
  return template
    .replaceAll("{{title}}", entry.title ?? entry.videoId)
    .replaceAll("{{url}}", entry.url)
    .replaceAll("{{channel}}", entry.videoMetadata?.channelName ?? "Unknown")
    .replaceAll("{{contentKind}}", entry.contentKind ?? "video")
    .replaceAll("{{language}}", entry.language ?? "Unknown")
    .replaceAll("{{tags}}", entry.videoMetadata?.tags?.join(", ") ?? "None")
    .replaceAll("{{duration}}", entry.videoMetadata?.durationText ?? "Unknown")
    .replaceAll("{{transcript}}", transcript);
}

export function buildTranscriptSummaryPrompt(
  entry: HistoryEntry,
  template: string,
): string {
  const transcript = materializeOutput(entry, "text");
  return interpolateTemplate(template, entry, transcript);
}

export function buildTranscriptQuestionPrompt(
  entry: HistoryEntry,
  question: string,
): string {
  const transcript = materializeOutput(entry, "text");

  return [
    "You are helping with questions about a YouTube transcript.",
    "Answer the user's question using the transcript as the primary source.",
    "Be concise, accurate, and explicit when the transcript does not support a claim.",
    "",
    `Video: ${entry.title ?? entry.videoId}`,
    `Channel: ${entry.videoMetadata?.channelName ?? "Unknown"}`,
    `Type: ${entry.contentKind ?? "video"}`,
    `Duration: ${entry.videoMetadata?.durationText ?? "Unknown"}`,
    `Language: ${entry.language ?? "Unknown"}`,
    `Tags: ${entry.videoMetadata?.tags?.join(", ") ?? "None"}`,
    `URL: ${entry.url}`,
    "",
    `Question: ${question.trim()}`,
    "",
    "Transcript:",
    transcript,
  ].join("\n");
}

export function buildSuggestedTranscriptQuestions(
  entry: HistoryEntry,
): string[] {
  const title = entry.title ?? entry.videoId;

  return [
    `What are the main ideas in "${title}"?`,
    `What action items or next steps are mentioned in "${title}"?`,
    `Which tools, products, or people are mentioned in "${title}"?`,
    `Give me the most important takeaways from "${title}".`,
  ];
}

export function updateRecentTranscriptQuestions(
  current: string[],
  question: string,
): string[] {
  const normalized = question.trim();
  if (!normalized) return current;

  return [normalized, ...current.filter((item) => item !== normalized)].slice(
    0,
    8,
  );
}
