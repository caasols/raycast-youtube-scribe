export const RETRY_TRANSCRIPT_INTENT_KEY = "transcript-retry-intent";

export type RetryTranscriptIntent = {
  type: "retry-transcript";
  url: string;
  language?: string;
};

export type NavigationIntent = RetryTranscriptIntent;

export function serializeRetryTranscriptIntent(
  input: Omit<RetryTranscriptIntent, "type">,
): string {
  return JSON.stringify({
    type: "retry-transcript",
    url: input.url,
    language: input.language || undefined,
  } satisfies RetryTranscriptIntent);
}

export function readRetryTranscriptIntent(
  raw: string | null | undefined,
): RetryTranscriptIntent | undefined {
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as Partial<NavigationIntent>;
    if (parsed.type !== "retry-transcript" || typeof parsed.url !== "string") {
      return undefined;
    }

    return {
      type: "retry-transcript",
      url: parsed.url,
      language:
        typeof parsed.language === "string" && parsed.language.trim()
          ? parsed.language
          : undefined,
    };
  } catch {
    return undefined;
  }
}

export async function consumeRetryTranscriptIntent(deps: {
  getItem: (key: string) => Promise<string | undefined | null>;
  removeItem: (key: string) => Promise<void>;
}): Promise<RetryTranscriptIntent | undefined> {
  const raw = await deps.getItem(RETRY_TRANSCRIPT_INTENT_KEY);
  if (!raw) return undefined;

  await deps.removeItem(RETRY_TRANSCRIPT_INTENT_KEY);
  return readRetryTranscriptIntent(raw);
}
