import { describe, expect, it } from "vitest";
import pkg from "../package.json";

describe("command metadata", () => {
  it("uses the cache-busted extension icon path", () => {
    expect(pkg.icon).toBe("extension-icon.png");
  });

  it("renames the main command to the new transcription title", () => {
    const command = pkg.commands.find(
      (entry) => entry.name === "get-youtube-transcript",
    );

    expect(command).toBeDefined();
    expect(command?.title).toBe("Transcribe YouTube Video");
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
    expect(historyCommand?.arguments ?? []).toEqual([]);
  });
});
