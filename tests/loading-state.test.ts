import { describe, expect, it } from "vitest";
import { getLoadingStateText } from "../src/lib/loading-state";

describe("getLoadingStateText", () => {
  it("describes the bootstrapping state", () => {
    expect(getLoadingStateText("bootstrapping")).toEqual({
      title: "Looking for a YouTube Source",
      description:
        "Checking the clipboard and focused browser tab before falling back to manual input.",
    });
  });

  it("describes the auto-run state", () => {
    expect(getLoadingStateText("auto-running")).toEqual({
      title: "Preparing Transcript Details",
      description:
        "Fetching the detected YouTube transcript now. The detail view will open automatically when it is ready.",
    });
  });
});
