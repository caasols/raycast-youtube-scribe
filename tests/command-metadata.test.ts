import { describe, expect, it } from "vitest";
import pkg from "../package.json";

describe("command metadata", () => {
  it("exposes the history command without arguments and with the new title", () => {
    const historyCommand = pkg.commands.find(
      (command) => command.name === "transcript-history",
    );

    expect(historyCommand).toBeDefined();
    expect(historyCommand?.title).toBe("View Transcript History");
    expect(historyCommand?.arguments ?? []).toEqual([]);
  });
});
