export type InitialLaunchMode = "auto-run" | "manual-form";

export function getInitialLaunchMode(input: {
  hasUrlArgument: boolean;
  hasLanguageArgument: boolean;
  hasFormatArgument: boolean;
  hasClipboardUrl: boolean;
  hasFocusedYoutubeTab: boolean;
}): InitialLaunchMode {
  if (
    input.hasUrlArgument ||
    input.hasLanguageArgument ||
    input.hasFormatArgument ||
    input.hasClipboardUrl ||
    input.hasFocusedYoutubeTab
  ) {
    return "auto-run";
  }

  return "manual-form";
}
