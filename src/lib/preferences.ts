import { getPreferenceValues } from "@raycast/api";
import { DEFAULT_SUMMARIZE_PROMPT_TEMPLATE } from "./prompt-templates";

type ExtensionPreferences = {
  summarizePromptTemplate?: string;
  historyLimit?: string;
  historyMaxAgeDays?: string;
};

export function getSummarizePromptTemplate(): string {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  return (
    preferences.summarizePromptTemplate?.trim() ||
    DEFAULT_SUMMARIZE_PROMPT_TEMPLATE
  );
}

export function getHistoryLimit(): number {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  const value = parseInt(preferences.historyLimit ?? "100", 10);
  return Number.isNaN(value) || value <= 0 ? 100 : value;
}

export function getHistoryMaxAgeDays(): number | null {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  const value = parseInt(preferences.historyMaxAgeDays ?? "0", 10);
  return Number.isNaN(value) || value <= 0 ? null : value;
}
