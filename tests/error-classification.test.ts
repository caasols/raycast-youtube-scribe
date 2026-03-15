import { describe, expect, it } from "vitest";

import {
  classifyTranscriptError,
  formatTranscriptError,
  isRetryable,
} from "../src/lib/error-classification";

describe("classifyTranscriptError", () => {
  it("classifies yt-dlp missing errors", () => {
    expect(classifyTranscriptError("yt-dlp is not installed")).toBe(
      "ytdlp-missing",
    );
  });

  it("classifies no-captions errors", () => {
    expect(classifyTranscriptError("no captions found for this video")).toBe(
      "no-captions",
    );
  });

  it("classifies sign-in errors as auth-required", () => {
    expect(
      classifyTranscriptError("Please sign in to access this content"),
    ).toBe("auth-required");
  });

  it("classifies cookie errors as auth-required", () => {
    expect(classifyTranscriptError("cookies are required")).toBe(
      "auth-required",
    );
  });

  it("classifies private video errors", () => {
    expect(classifyTranscriptError("This video is private")).toBe(
      "private-or-deleted",
    );
  });

  it("classifies video unavailable errors", () => {
    expect(classifyTranscriptError("Video unavailable")).toBe(
      "private-or-deleted",
    );
  });

  it("classifies rate limit errors", () => {
    expect(classifyTranscriptError("HTTP Error 429")).toBe("rate-limited");
  });

  it("classifies too-many-requests errors", () => {
    expect(classifyTranscriptError("too many requests")).toBe("rate-limited");
  });

  it("classifies rate limit text errors", () => {
    expect(classifyTranscriptError("rate limit exceeded")).toBe("rate-limited");
  });

  it("classifies timeout errors", () => {
    expect(classifyTranscriptError("timed out while fetching")).toBe(
      "timeout",
    );
  });

  it("returns unknown for unrecognized errors", () => {
    expect(classifyTranscriptError("something weird happened")).toBe("unknown");
  });

  it("returns unknown for empty strings", () => {
    expect(classifyTranscriptError("")).toBe("unknown");
  });
});

describe("formatTranscriptError", () => {
  it("formats timeout errors", () => {
    expect(formatTranscriptError("timeout")).toBe(
      "yt-dlp timed out while fetching captions. Please retry. If it keeps happening, open the debug log from history.",
    );
  });

  it("formats no-captions errors", () => {
    expect(formatTranscriptError("no-captions")).toBe(
      "No transcript track is available for this video.",
    );
  });

  it("formats auth-required errors", () => {
    expect(formatTranscriptError("auth-required")).toBe(
      "This video requires browser cookies or sign-in access to fetch captions.",
    );
  });

  it("formats private-or-deleted errors", () => {
    expect(formatTranscriptError("private-or-deleted")).toBe(
      "This video is unavailable (private, removed, or restricted).",
    );
  });

  it("formats rate-limited errors", () => {
    expect(formatTranscriptError("rate-limited")).toBe(
      "YouTube is rate-limiting transcript requests right now. Please try again in a moment.",
    );
  });

  it("formats ytdlp-missing errors", () => {
    expect(formatTranscriptError("ytdlp-missing")).toContain(
      "yt-dlp is not installed.",
    );
  });

  it("formats unknown errors with fallback message", () => {
    expect(formatTranscriptError("unknown")).toBe("Failed to fetch transcript.");
  });
});

describe("isRetryable", () => {
  it.each([
    ["timeout", true],
    ["rate-limited", true],
    ["auth-required", true],
    ["unknown", true],
    ["no-captions", false],
    ["private-or-deleted", false],
    ["ytdlp-missing", false],
  ] as const)("returns %s for %s", (kind, expected) => {
    expect(isRetryable(kind)).toBe(expected);
  });
});
