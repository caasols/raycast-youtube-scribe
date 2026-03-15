import { describe, expect, it } from "vitest";
import pkg from "../package.json";

describe("command metadata", () => {
  it("renames the extension to YouTube Transcribe", () => {
    expect(pkg.name).toBe("youtube-transcribe");
    expect(pkg.title).toBe("YouTube Transcribe");
  });

  it("uses the cache-busted extension icon path", () => {
    expect(pkg.icon).toBe("extension-icon.png");
  });

  it("renames the main command to the new transcription title", () => {
    const command = pkg.commands.find(
      (entry) => entry.name === "get-youtube-transcript",
    );

    expect(command).toBeDefined();
    expect(command?.title).toBe("Transcribe YouTube Video");
    expect(command?.subtitle).toBe("YouTube Transcribe");
    expect(command?.arguments ?? []).toEqual([
      {
        name: "language",
        type: "text",
        placeholder: "Language code, e.g. en, pt, es (optional)",
        required: false,
      },
    ]);
  });

  it("exposes the history command without arguments and with the new title", () => {
    const historyCommand = pkg.commands.find(
      (command) => command.name === "transcript-history",
    );

    expect(historyCommand).toBeDefined();
    expect(historyCommand?.title).toBe("View Transcript History");
    expect(historyCommand?.subtitle).toBe("YouTube Transcribe");
    expect(historyCommand?.arguments ?? []).toEqual([]);
  });

  it("includes the background worker command as a no-view internal fetcher", () => {
    const workerCommand = pkg.commands.find(
      (command) => command.name === "fetch-youtube-transcript-worker",
    );

    expect(workerCommand).toBeDefined();
    expect(workerCommand?.mode).toBe("no-view");
    expect(workerCommand?.description).toBe(
      "Internal background worker for transcript fetching",
    );
  });
});
