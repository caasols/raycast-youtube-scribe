import { HistoryEntry } from "../types";

export type HistoryStatusPresentation = {
  tone: "green" | "orange" | "red";
  tooltip: string;
};

export function buildHistoryStatusPresentation(
  entry: HistoryEntry,
): HistoryStatusPresentation {
  if (entry.status === "finished") {
    return {
      tone: "green",
      tooltip: "Transcript ready",
    };
  }

  if (entry.status === "fetching") {
    return {
      tone: "orange",
      tooltip: "Fetching transcript",
    };
  }

  return {
    tone: "red",
    tooltip: "Fetch failed",
  };
}
