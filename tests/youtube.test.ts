import { describe, expect, it } from "vitest";
import {
  detectYoutubeContentKind,
  extractVideoId,
  extractYoutubeUrlFromText,
  makeFetchKey,
  normalizeLanguage,
  normalizeYoutubeVideoUrl,
} from "../src/lib/youtube";

describe("youtube helpers", () => {
  it("extracts a video id from watch, short, shorts, and raw id inputs", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("normalizes supported video inputs to canonical watch urls", () => {
    expect(normalizeYoutubeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43s")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(normalizeYoutubeVideoUrl("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(normalizeYoutubeVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(normalizeYoutubeVideoUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  it("detects shorts distinctly from regular videos", () => {
    expect(
      detectYoutubeContentKind("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("video");
    expect(
      detectYoutubeContentKind("https://youtu.be/dQw4w9WgXcQ"),
    ).toBe("video");
    expect(
      detectYoutubeContentKind("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe("short");
    expect(detectYoutubeContentKind("dQw4w9WgXcQ")).toBe("video");
  });

  it("rejects non-youtube input", () => {
    expect(() => extractVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toThrow(
      "Please provide a valid YouTube URL or video ID.",
    );
  });

  it("extracts the first supported youtube video url from clipboard text", () => {
    expect(extractYoutubeUrlFromText("notes https://youtu.be/dQw4w9WgXcQ extra")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(
      extractYoutubeUrlFromText(
        "channel https://www.youtube.com/@veritasium then video https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      ),
    ).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(extractYoutubeUrlFromText("not a url")).toBeNull();
    expect(extractYoutubeUrlFromText("https://www.youtube.com/@veritasium")).toBeNull();
    expect(extractYoutubeUrlFromText("https://www.youtube.com/")).toBeNull();
    expect(
      extractYoutubeUrlFromText("https://www.youtube.com/@AI_In_Context/videos"),
    ).toBeNull();
  });

  it("normalizes language and generates unique fetch keys", () => {
    expect(normalizeLanguage(" En ")).toBe("en");
    expect(normalizeLanguage("")).toBe("");
    expect(makeFetchKey("dQw4w9WgXcQ", "en")).toBe("dQw4w9WgXcQ::en");
    expect(makeFetchKey("dQw4w9WgXcQ", "")).toBe("dQw4w9WgXcQ::auto");
  });
});
