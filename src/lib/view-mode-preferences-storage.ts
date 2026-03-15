import { LocalStorage } from "@raycast/api";
import { OutputFormat } from "../types";
import {
  updateViewModePreferences,
  ViewModePreferences,
} from "./view-mode-preferences";

const VIEW_MODE_PREFERENCES_KEY = "transcript-history-view-mode-preferences";

export async function loadViewModePreferences(): Promise<ViewModePreferences> {
  const raw = await LocalStorage.getItem<string>(VIEW_MODE_PREFERENCES_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: ViewModePreferences = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (value === "text" || value === "json") {
        next[key] = value;
      }
    }

    return next;
  } catch {
    return {};
  }
}

export async function saveViewModePreference(
  fetchKey: string,
  mode: OutputFormat,
): Promise<ViewModePreferences> {
  const current = await loadViewModePreferences();
  const next = updateViewModePreferences(current, fetchKey, mode);
  await LocalStorage.setItem(VIEW_MODE_PREFERENCES_KEY, JSON.stringify(next));
  return next;
}
