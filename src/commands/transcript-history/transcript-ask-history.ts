import { LocalStorage } from "@raycast/api";

const ASK_HISTORY_KEY = "transcript-ask-history";

export async function loadTranscriptAskHistory(): Promise<string[]> {
  const raw = await LocalStorage.getItem<string>(ASK_HISTORY_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export async function saveTranscriptAskHistory(
  questions: string[],
): Promise<void> {
  await LocalStorage.setItem(ASK_HISTORY_KEY, JSON.stringify(questions));
}
