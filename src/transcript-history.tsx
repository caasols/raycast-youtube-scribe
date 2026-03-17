import {
  Action,
  ActionPanel,
  Alert,
  Color,
  Icon,
  LaunchProps,
  List,
  LocalStorage,
  Toast,
  confirmAlert,
  launchCommand,
  showToast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import {
  clearBackgroundCompletedFlags,
  clearHistory,
  loadHistory,
  saveHistory,
} from "./history-store";
import { matchesHistoryQuery } from "./lib/history-logic";
import { buildHistoryDetailMarkdown } from "./lib/history-detail";
import { buildHistoryStatusPresentation } from "./lib/history-status";
import { buildHistoryRowPresentation } from "./lib/history-row";
import { HistoryEntry } from "./types";
import { TranscriptDetailView } from "./commands/shared/transcript-detail-view";
import { materializeOutput } from "./lib/output";
import { retryFetch as retryFetchAction } from "./commands/transcript-history/history-actions";
import { TranscriptSearchView } from "./commands/shared/transcript-search-view";
import { TranscriptSummaryView } from "./commands/transcript-history/transcript-summary-view";
import { TranscriptAskView } from "./commands/transcript-history/transcript-ask-view";

function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;

  let i = 0;
  for (const ch of q) {
    i = t.indexOf(ch, i);
    if (i === -1) return false;
    i += 1;
  }
  return true;
}

function statusAccessory(entry: HistoryEntry) {
  const presentation = buildHistoryStatusPresentation(entry);
  const tintColor =
    presentation.tone === "green"
      ? Color.Green
      : presentation.tone === "orange"
        ? Color.Orange
        : Color.Red;

  return {
    icon: { source: Icon.CircleFilled, tintColor },
    tooltip: presentation.tooltip,
  };
}

type HistoryLaunchContext = {
  entryId?: string;
};

export default function Command(
  props: LaunchProps<{ launchContext: HistoryLaunchContext }>,
) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const selectedItemId = props.launchContext?.entryId;

  async function refresh() {
    setIsLoading(true);
    const entries = await loadHistory();
    setHistory(entries);
    setIsLoading(false);
  }

  useEffect(() => {
    async function bootstrap() {
      await refresh();
    }

    bootstrap();
  }, []);

  useEffect(() => {
    if (!history.some((entry) => entry.status === "fetching")) return;

    const timer = setInterval(() => {
      refresh();
    }, 1500);

    return () => clearInterval(timer);
  }, [history]);

  useEffect(() => {
    clearBackgroundCompletedFlags();
  }, []);

  async function retryFetch(entry: HistoryEntry) {
    await retryFetchAction(entry, {
      clearFocusedEntry: () => undefined,
      setLocalStorageItem: (key, value) => LocalStorage.setItem(key, value),
      launchCommand,
    });
  }

  async function removeEntry(id: string) {
    const next = history.filter((entry) => entry.id !== id);
    setHistory(next);
    await saveHistory(next);
    await showToast({
      style: Toast.Style.Success,
      title: "Removed from history",
    });
  }

  async function removeAll() {
    const ok = await confirmAlert({
      title: "Clear transcript history?",
      message:
        "This removes all previously fetched transcripts from local history.",
      primaryAction: { title: "Clear", style: Alert.ActionStyle.Destructive },
    });

    if (!ok) return;

    await clearHistory();
    setHistory([]);
    await showToast({ style: Toast.Style.Success, title: "History cleared" });
  }

  const filteredHistory = useMemo(() => {
    if (!searchText.trim()) return history;
    return history.filter(
      (entry) =>
        matchesHistoryQuery(entry, searchText) ||
        fuzzyMatch(entry.title || entry.videoId, searchText),
    );
  }, [history, searchText]);

  const rowActions = (entry: HistoryEntry) => (
    <ActionPanel>
      {entry.status === "finished" ? (
        <>
          <Action.Push
            title="Ask AI About Transcript"
            icon={Icon.Stars}
            target={<TranscriptAskView entry={entry} />}
            shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
          />
          <Action.Push
            title="Summarize Transcript"
            icon={Icon.BulletPoints}
            target={<TranscriptSummaryView entry={entry} />}
            shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
          />
          <Action.CopyToClipboard
            title="Copy Transcript"
            content={materializeOutput(entry, "text")}
          />
          <Action.Push
            title="Search in Transcript"
            icon={Icon.MagnifyingGlass}
            target={<TranscriptSearchView entry={entry} />}
            shortcut={{ modifiers: ["cmd"], key: "f" }}
          />
          <Action.Push
            title="View Details"
            icon={Icon.Sidebar}
            target={
              <TranscriptDetailView
                entry={entry}
                onRetry={() => retryFetch(entry)}
              />
            }
          />
          <Action.OpenInBrowser
            title="Open Video"
            url={entry.url}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
          />
          <Action.CopyToClipboard
            title="Copy Debug Log"
            content={entry.debugLog ?? "No debug data"}
          />
          <Action
            title="Remove from History"
            style={Action.Style.Destructive}
            icon={Icon.Trash}
            onAction={() => removeEntry(entry.id)}
          />
          <Action
            title="Clear History"
            style={Action.Style.Destructive}
            icon={Icon.Trash}
            shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
            onAction={removeAll}
          />
        </>
      ) : entry.status === "error" ? (
        <>
          <Action
            title="Retry Fetch"
            icon={Icon.ArrowClockwise}
            onAction={() => retryFetch(entry)}
          />
          <Action.Push
            title="View Details"
            icon={Icon.Sidebar}
            target={
              <TranscriptDetailView
                entry={entry}
                onRetry={() => retryFetch(entry)}
              />
            }
          />
          <Action.OpenInBrowser
            title="Open Video"
            url={entry.url}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
          />
          <Action.CopyToClipboard
            title="Copy Debug Log"
            content={entry.debugLog ?? "No debug data"}
          />
          <Action
            title="Remove from History"
            style={Action.Style.Destructive}
            icon={Icon.Trash}
            onAction={() => removeEntry(entry.id)}
          />
          <Action
            title="Clear History"
            style={Action.Style.Destructive}
            icon={Icon.Trash}
            shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
            onAction={removeAll}
          />
        </>
      ) : (
        <>
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={refresh}
          />
          <Action.OpenInBrowser
            title="Open Video"
            url={entry.url}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
          />
          <Action.CopyToClipboard
            title="Copy Debug Log"
            content={entry.debugLog ?? "No debug data"}
          />
          <Action
            title="Remove from History"
            style={Action.Style.Destructive}
            icon={Icon.Trash}
            onAction={() => removeEntry(entry.id)}
          />
          <Action
            title="Clear History"
            style={Action.Style.Destructive}
            icon={Icon.Trash}
            shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
            onAction={removeAll}
          />
        </>
      )}
    </ActionPanel>
  );

  const renderItem = (entry: HistoryEntry) => (
    <List.Item
      key={entry.id}
      id={entry.id}
      title={buildHistoryRowPresentation(entry).title}
      subtitle={buildHistoryRowPresentation(entry).subtitle}
      detail={
        <List.Item.Detail
          markdown={buildHistoryDetailMarkdown(entry, "text", {
            surface: "history-pane",
          })}
        />
      }
      accessories={[
        ...(entry.backgroundCompletedAt
          ? [{ tag: { value: "New", color: Color.Blue } }]
          : []),
        {
          icon: statusAccessory(entry).icon,
          tooltip: statusAccessory(entry).tooltip,
        },
      ]}
      actions={rowActions(entry)}
    />
  );

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={true}
      filtering={false}
      searchBarPlaceholder="Search transcript history..."
      searchText={searchText}
      onSearchTextChange={setSearchText}
      selectedItemId={selectedItemId}
    >
      {filteredHistory.length === 0 ? (
        <List.EmptyView
          icon={Icon.Clock}
          title="No history yet"
          description="Run 'Transcribe YouTube Video' first. This command shows all transcripts fetched previously."
        />
      ) : (
        filteredHistory.map(renderItem)
      )}
    </List>
  );
}
