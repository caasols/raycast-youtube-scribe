import {
  RETRY_TRANSCRIPT_INTENT_KEY,
  serializeRetryTranscriptIntent,
} from "../../lib/navigation-intents";
import type { HistoryEntry } from "../../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LaunchCommandFn = (...args: any[]) => Promise<void>;

export type RetryFetchDeps = {
  clearFocusedEntry: () => void;
  setLocalStorageItem: (key: string, value: string) => Promise<void>;
  launchCommand: LaunchCommandFn;
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
