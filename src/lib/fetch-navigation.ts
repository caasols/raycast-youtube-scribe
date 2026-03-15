import { HistoryEntry } from "../types";

export function getFetchCompletionDestination(
  entry: HistoryEntry,
): "detail" | "history" {
  return entry.status === "finished" ? "detail" : "history";
}
