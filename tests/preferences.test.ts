import { describe, expect, it } from "vitest";
import { orderAIActions } from "../src/lib/preferences";

describe("orderAIActions", () => {
  // Raycast binds Enter to the first action in an ActionPanel, so ordering is
  // the whole mechanism behind the Default AI Action preference.
  it("puts summarize first when the preference is summarize", () => {
    expect(orderAIActions("summarize")).toEqual(["summarize", "ask"]);
  });

  it("puts ask first when the preference is ask", () => {
    expect(orderAIActions("ask")).toEqual(["ask", "summarize"]);
  });

  it("always returns both actions exactly once", () => {
    for (const pref of ["summarize", "ask"] as const) {
      expect([...orderAIActions(pref)].sort()).toEqual(["ask", "summarize"]);
    }
  });
});
