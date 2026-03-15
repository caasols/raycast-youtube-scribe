import { OutputFormat } from "../types";

export type ViewModePreferences = Record<string, OutputFormat>;

export function resolveViewModePreference(
  preferences: ViewModePreferences,
  fetchKey?: string,
): OutputFormat {
  if (!fetchKey) {
    return "text";
  }

  return preferences[fetchKey] ?? "text";
}

export function updateViewModePreferences(
  preferences: ViewModePreferences,
  fetchKey: string,
  mode: OutputFormat,
): ViewModePreferences {
  return {
    ...preferences,
    [fetchKey]: mode,
  };
}
