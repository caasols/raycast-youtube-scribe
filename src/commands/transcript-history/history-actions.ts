import {
  RETRY_TRANSCRIPT_INTENT_KEY,
  serializeRetryTranscriptIntent,
} from "../../lib/navigation-intents";
import type { HistoryEntry } from "../../types";

export type RetryFetchDeps = {
  clearFocusedEntry: () => void;
  setLocalStorageItem: (key: string, value: string) => Promise<void>;
  launchCommand: (options: {
    ownerOrAuthorName: string;
    extensionName: string;
    name: string;
    type: string;
    arguments?: Record<string, string>;
  }) => Promise<void>;
};

export async function retryFetch(entry: HistoryEntry, deps: RetryFetchDeps) {
  deps.clearFocusedEntry();
  await deps.setLocalStorageItem(
    RETRY_TRANSCRIPT_INTENT_KEY,
    serializeRetryTranscriptIntent({
      url: entry.url,
      language: entry.language,
    }),
  );
  await deps.launchCommand({
    ownerOrAuthorName: "caasols",
    extensionName: "youtube-transcribe",
    name: "get-youtube-transcript",
    type: "userInitiated",
    arguments: {
      language: entry.language ?? "",
    },
  });
}
