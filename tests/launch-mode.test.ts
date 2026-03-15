import { describe, expect, it } from "vitest";
import { getInitialLaunchMode } from "../src/lib/launch-mode";

describe("getInitialLaunchMode", () => {
  it("does not auto-run when only a language argument is present", () => {
    expect(
      getInitialLaunchMode({
        hasLanguageArgument: true,
        hasClipboardUrl: false,
        hasFocusedYoutubeTab: false,
      }),
    ).toBe("manual-form");
  });

  it("auto-runs when a clipboard url or focused tab is available", () => {
    expect(
      getInitialLaunchMode({
        hasLanguageArgument: false,
        hasClipboardUrl: true,
        hasFocusedYoutubeTab: false,
      }),
    ).toBe("auto-run");

    expect(
      getInitialLaunchMode({
        hasLanguageArgument: false,
        hasClipboardUrl: false,
        hasFocusedYoutubeTab: true,
      }),
    ).toBe("auto-run");
  });

  it("shows the fallback form only when no auto-detect source exists", () => {
    expect(
      getInitialLaunchMode({
        hasLanguageArgument: false,
        hasClipboardUrl: false,
        hasFocusedYoutubeTab: false,
      }),
    ).toBe("manual-form");
  });
});
