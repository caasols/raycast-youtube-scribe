export type InitialLaunchMode = "auto-run" | "manual-form";

export function getInitialLaunchMode(input: {
  hasLanguageArgument: boolean;
  hasClipboardUrl: boolean;
  hasFocusedYoutubeTab: boolean;
}): InitialLaunchMode {
  if (input.hasClipboardUrl || input.hasFocusedYoutubeTab) {
    return "auto-run";
  }

  return "manual-form";
}
