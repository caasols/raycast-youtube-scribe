import { describe, expect, it } from "vitest";
import {
  getLoadingStateMarkdown,
  getLoadingStateText,
} from "../src/lib/loading-state";

describe("getLoadingStateText", () => {
  it("describes the detecting state", () => {
    expect(getLoadingStateText("detecting")).toEqual({
      title: "Detecting Video",
      progressLabel: "Step 1 of 3",
      progressBar: "▒▒▒▒░░░░░░░░░░░░",
      description:
        "Checking clipboard and browser tab for a YouTube video.",
    });
  });

  it("describes the fetching state", () => {
    expect(getLoadingStateText("fetching")).toEqual({
      title: "Fetching Transcript",
      progressLabel: "Step 2 of 3",
      progressBar: "█████▒▒▒▒▒░░░░░░",
      description:
        "Fetching captions for the detected video. This may take a few seconds.",
    });
  });

  it("describes the opening state", () => {
    expect(getLoadingStateText("opening")).toEqual({
      title: "Opening Transcript",
      progressLabel: "Step 3 of 3",
      progressBar: "███████████▒▒▒▒▒",
      description: "Transcript ready. Opening the detail view now.",
    });
  });
});

describe("getLoadingStateMarkdown", () => {
  it("renders a 3-step list with the current step emphasized", () => {
    const markdown = getLoadingStateMarkdown("fetching");
    expect(markdown).toContain("**Step 2 of 3 · █████▒▒▒▒▒░░░░░░**");
    expect(markdown).toContain("- [x] Detecting video");
    expect(markdown).toContain("- [ ] **Fetching transcript**");
    expect(markdown).toContain("- [ ] Opening transcript");
  });
});
