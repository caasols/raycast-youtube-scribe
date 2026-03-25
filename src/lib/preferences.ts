import { getPreferenceValues } from "@raycast/api";
import { DEFAULT_SUMMARIZE_PROMPT_TEMPLATE } from "./prompt-templates";

export type HistorySortOrder = "newest" | "oldest" | "title-asc" | "title-desc" | "channel";

type ExtensionPreferences = {
  autoSummarize?: boolean;
  summarizePromptTemplate?: string;
  customAction1Name?: string;
  customAction1Prompt?: string;
  customAction2Name?: string;
  customAction2Prompt?: string;
  historyLimit?: string;
  historyMaxAgeDays?: string;
  aiChatMaxAgeDays?: string;
  aiResponseLanguage?: string;
  aiModel?: string;
  historySortOrder?: string;
  defaultAIAction?: string;
};

export type CustomAction = {
  name: string;
  prompt: string;
};

export function getCustomActions(): CustomAction[] {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  const actions: CustomAction[] = [];

  const name1 = preferences.customAction1Name?.trim();
  const prompt1 = preferences.customAction1Prompt?.trim();
  if (name1 && prompt1) actions.push({ name: name1, prompt: prompt1 });

  const name2 = preferences.customAction2Name?.trim();
  const prompt2 = preferences.customAction2Prompt?.trim();
  if (name2 && prompt2) actions.push({ name: name2, prompt: prompt2 });

  return actions;
}

export function getAutoSummarize(): boolean {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  return preferences.autoSummarize === true;
}

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

export function getDefaultAIAction(): "summarize" | "ask" {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  return preferences.defaultAIAction === "ask" ? "ask" : "summarize";
}

export function getAiResponseLanguage(): string | null {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  const value = preferences.aiResponseLanguage?.trim();
  return value && value !== "auto" ? value : null;
}

export function getAiChatMaxAgeDays(): number | null {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  const value = parseInt(preferences.aiChatMaxAgeDays ?? "0", 10);
  return Number.isNaN(value) || value <= 0 ? null : value;
}

export function getHistorySortOrder(): HistorySortOrder {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  const value = preferences.historySortOrder;
  const valid: HistorySortOrder[] = ["newest", "oldest", "title-asc", "title-desc", "channel"];
  return valid.includes(value as HistorySortOrder)
    ? (value as HistorySortOrder)
    : "newest";
}

export function getAiModel(): string | undefined {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  const value = preferences.aiModel?.trim();
  return value && value !== "auto" ? value : undefined;
}

export function getHistoryMaxAgeDays(): number | null {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  const value = parseInt(preferences.historyMaxAgeDays ?? "0", 10);
  return Number.isNaN(value) || value <= 0 ? null : value;
}
