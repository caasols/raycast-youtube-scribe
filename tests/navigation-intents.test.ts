import { describe, expect, it } from "vitest";
import {
  consumeRetryTranscriptIntent,
  readRetryTranscriptIntent,
  RETRY_TRANSCRIPT_INTENT_KEY,
  serializeRetryTranscriptIntent,
} from "../src/lib/navigation-intents";

describe("navigation intents", () => {
  it("serializes and reads a retry transcript intent", () => {
    const raw = serializeRetryTranscriptIntent({
      url: "https://www.youtube.com/watch?v=abc",
      language: "pt",
    });

    expect(JSON.parse(raw)).toEqual({
      type: "retry-transcript",
      url: "https://www.youtube.com/watch?v=abc",
      language: "pt",
    });
    expect(readRetryTranscriptIntent(raw)).toEqual({
      type: "retry-transcript",
      url: "https://www.youtube.com/watch?v=abc",
      language: "pt",
    });
  });

  it("normalizes blank language values and ignores invalid payloads", () => {
    const raw = JSON.stringify({
      type: "retry-transcript",
      url: "https://www.youtube.com/watch?v=abc",
      language: "",
    });

    expect(readRetryTranscriptIntent(raw)).toEqual({
      type: "retry-transcript",
      url: "https://www.youtube.com/watch?v=abc",
      language: undefined,
    });
    expect(readRetryTranscriptIntent('{"type":"other"}')).toBeUndefined();
    expect(readRetryTranscriptIntent("not-json")).toBeUndefined();
  });

  it("consumes retry intents from storage and clears the key", async () => {
    const getItem = async (key: string) =>
      key === RETRY_TRANSCRIPT_INTENT_KEY
        ? JSON.stringify({
            type: "retry-transcript",
            url: "https://www.youtube.com/watch?v=abc",
          })
        : undefined;
    const removed: string[] = [];

    const intent = await consumeRetryTranscriptIntent({
      getItem,
      removeItem: async (key) => {
        removed.push(key);
      },
    });

    expect(intent).toEqual({
      type: "retry-transcript",
      url: "https://www.youtube.com/watch?v=abc",
      language: undefined,
    });
    expect(removed).toEqual([RETRY_TRANSCRIPT_INTENT_KEY]);
  });
});
