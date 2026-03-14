import { describe, expect, it } from "vitest";
import { getInitialLaunchMode } from "../src/lib/launch-mode";

describe("getInitialLaunchMode", () => {
  it("auto-runs when explicit arguments are present", () => {
    expect(
      getInitialLaunchMode({
        hasUrlArgument: true,
        hasLanguageArgument: false,
        hasFormatArgument: false,
        hasClipboardUrl: false,
        hasFocusedYoutubeTab: false,
      }),
    ).toBe("auto-run");
  });

  it("auto-runs when a clipboard url or focused tab is available", () => {
    expect(
      getInitialLaunchMode({
        hasUrlArgument: false,
        hasLanguageArgument: false,
        hasFormatArgument: false,
        hasClipboardUrl: true,
        hasFocusedYoutubeTab: false,
      }),
    ).toBe("auto-run");

    expect(
      getInitialLaunchMode({
        hasUrlArgument: false,
        hasLanguageArgument: false,
        hasFormatArgument: false,
        hasClipboardUrl: false,
        hasFocusedYoutubeTab: true,
      }),
    ).toBe("auto-run");
  });

  it("shows the fallback form only when no auto-detect source exists", () => {
    expect(
      getInitialLaunchMode({
        hasUrlArgument: false,
        hasLanguageArgument: false,
        hasFormatArgument: false,
        hasClipboardUrl: false,
        hasFocusedYoutubeTab: false,
      }),
    ).toBe("manual-form");
  });
});
