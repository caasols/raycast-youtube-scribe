import { HistoryEntry } from "../types";

export type HistoryRowPresentation = {
  title: string;
  subtitle?: string;
  icon?: undefined;
};

export function buildHistoryRowPresentation(
  entry: HistoryEntry,
): HistoryRowPresentation {
  return {
    title: entry.title || entry.videoId,
    subtitle: undefined,
  };
}
