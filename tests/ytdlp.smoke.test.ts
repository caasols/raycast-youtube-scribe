import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fetchTranscriptWithYtDlp, findYtDlp } from "../src/lib/ytdlp";

const shouldRun = process.env.RUN_YTDLP_SMOKE === "1";
const smokeTest = shouldRun ? it : it.skip;

describe("yt-dlp smoke", () => {
  smokeTest(
    "fetches a public transcript when yt-dlp is installed",
    async () => {
      const location = findYtDlp();

      expect(location).not.toBeNull();
      expect(location && existsSync(location.path)).toBe(true);

      try {
        const result = await fetchTranscriptWithYtDlp({
          videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          requestedLanguage: "en",
          ytDlpPath: location!.path,
        });

        expect(result.segmentCount).toBeGreaterThan(0);
        expect(result.textOutput.length).toBeGreaterThan(0);
        expect(result.videoMetadata).toBeDefined();
        expect(result.videoMetadata?.channelName).toBeTruthy();
        expect(
          result.videoMetadata?.creatorHandle ??
            result.videoMetadata?.channelName,
        ).toBeTruthy();
        expect(
          result.videoMetadata?.thumbnailUrl ??
            "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
        ).toContain("http");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("Too Many Requests") ||
          message.includes("HTTP Error 429")
        ) {
          expect(message).toMatch(/Too Many Requests|HTTP Error 429/);
          return;
        }

        throw error;
      }
    },
    20000,
  );
});
