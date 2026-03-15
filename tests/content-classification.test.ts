import { describe, expect, it } from "vitest";
import { classifyContentKind } from "../src/lib/content-classification";

describe("classifyContentKind", () => {
  it("returns urlKind when no metadata", () => {
    expect(classifyContentKind("video")).toBe("video");
    expect(classifyContentKind("short")).toBe("short");
  });

  it("returns urlKind when no liveStatus", () => {
    expect(classifyContentKind("video", { channelName: "test" })).toBe("video");
  });

  it("classifies is_upcoming as premiere", () => {
    expect(
      classifyContentKind("video", { liveStatus: "is_upcoming" }),
    ).toBe("premiere");
  });

  it("classifies is_live as live", () => {
    expect(
      classifyContentKind("video", { liveStatus: "is_live" }),
    ).toBe("live");
  });

  it("classifies was_live as live", () => {
    expect(
      classifyContentKind("video", { liveStatus: "was_live" }),
    ).toBe("live");
  });

  it("returns urlKind for unknown liveStatus", () => {
    expect(
      classifyContentKind("short", { liveStatus: "not_live" }),
    ).toBe("short");
  });
});
