import { useEffect, useState } from "react";
import { hydrateEntry } from "../history-store";
import type { HistoryEntry } from "../types";

/**
 * Reattach a transcript body to an entry that came from the history index.
 *
 * Since schema v6 the index carries no `rawSegments`, so any surface that reads,
 * searches, exports, or prompts an AI over the transcript has to hydrate first.
 * Entries that already carry a body (a fetch that just completed in-process)
 * pass straight through with no storage read.
 */
export function useHydratedEntry(entry: HistoryEntry): {
  entry: HistoryEntry;
  isHydrating: boolean;
} {
  const alreadyHydrated =
    Boolean(entry.rawSegments?.length) || entry.status !== "finished";

  const [hydrated, setHydrated] = useState<HistoryEntry>(entry);
  const [isHydrating, setIsHydrating] = useState(!alreadyHydrated);

  useEffect(() => {
    if (alreadyHydrated) {
      setHydrated(entry);
      setIsHydrating(false);
      return;
    }

    let cancelled = false;
    setIsHydrating(true);

    hydrateEntry(entry)
      .then((full) => {
        if (!cancelled) setHydrated(full);
      })
      .finally(() => {
        if (!cancelled) setIsHydrating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entry.id, alreadyHydrated]);

  return { entry: hydrated, isHydrating };
}
