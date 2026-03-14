import { describe, expect, it } from "vitest";
import { extractVideoId, extractYoutubeUrlFromText, makeFetchKey, normalizeLanguage } from "../src/lib/youtube";

describe("youtube helpers", () => {
  it("extracts a video id from watch, short, shorts, and raw id inputs", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects non-youtube input", () => {
    expect(() => extractVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toThrow(
      "Please provide a valid YouTube URL or video ID.",
    );
  });

  it("extracts the first youtube url from clipboard text", () => {
    expect(extractYoutubeUrlFromText("notes https://youtu.be/dQw4w9WgXcQ extra")).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(extractYoutubeUrlFromText("not a url")).toBeNull();
  });

  it("normalizes language and generates unique fetch keys", () => {
    expect(normalizeLanguage(" En ")).toBe("en");
    expect(normalizeLanguage("")).toBe("");
    expect(makeFetchKey("dQw4w9WgXcQ", "en")).toBe("dQw4w9WgXcQ::en");
    expect(makeFetchKey("dQw4w9WgXcQ", "")).toBe("dQw4w9WgXcQ::auto");
  });
});
