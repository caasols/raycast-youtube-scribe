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
  patchHistoryEntry,
  saveHistory,
} from "./history-store";
import { matchesHistoryQuery } from "./lib/history-logic";
import { buildHistoryDetailMarkdown } from "./lib/history-detail";
import { buildHistoryStatusPresentation } from "./lib/history-status";
import { buildHistoryRowPresentation } from "./lib/history-row";
import { HistoryEntry } from "./types";
import { TranscriptDetailView } from "./commands/shared/transcript-detail-view";
import { buildRichTextHtml, materializeOutput } from "./lib/output";
import { retryFetch as retryFetchAction } from "./commands/transcript-history/history-actions";
import { TranscriptSearchView } from "./commands/shared/transcript-search-view";
import { TranscriptSummaryView } from "./commands/transcript-history/transcript-summary-view";
import { TranscriptAskView } from "./commands/transcript-history/transcript-ask-view";
import { getCustomActions, getDefaultAIAction, getHistorySortOrder } from "./lib/preferences";
import { AiChatsView, hasAiChats } from "./commands/transcript-history/ai-chats-view";
import { TranscriptCustomActionView } from "./commands/transcript-history/transcript-custom-action-view";

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

type NavigateTarget = "summary" | "ask" | "ai-chats";

type HistoryLaunchContext = {
  entryId?: string;
  navigateTo?: NavigateTarget;
};

export default function Command(
  props: LaunchProps<{ launchContext: HistoryLaunchContext }>,
) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const selectedItemId = props.launchContext?.entryId;
  const [autoNav, setAutoNav] = useState<{
    entry: HistoryEntry;
    target: NavigateTarget;
  } | null>(null);

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
    const ms = history.some((entry) => entry.status === "fetching")
      ? 1500
      : 3000;
    const timer = setInterval(refresh, ms);
    return () => clearInterval(timer);
  }, [history]);

  useEffect(() => {
    clearBackgroundCompletedFlags();
  }, []);

  useEffect(() => {
    const ctx = props.launchContext;
    if (!ctx?.navigateTo || !ctx?.entryId || history.length === 0) return;
    const found = history.find((e) => e.id === ctx.entryId);
    if (found) setAutoNav({ entry: found, target: ctx.navigateTo });
  }, [history]);

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

  async function togglePinEntry(entry: HistoryEntry) {
    await patchHistoryEntry(entry.id, { pinned: !entry.pinned });
    await refresh();
    await showToast({
      style: Toast.Style.Success,
      title: entry.pinned ? "Unpinned" : "Pinned",
    });
  }

  const sortOrder = getHistorySortOrder();

  const filteredHistory = useMemo(() => {
    const filtered = searchText.trim()
      ? history.filter(
          (entry) =>
            matchesHistoryQuery(entry, searchText) ||
            fuzzyMatch(entry.title || entry.videoId, searchText),
        )
      : history;

    return [...filtered].sort((a, b) => {
      // Pinned items always first
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      if (bPinned !== aPinned) return bPinned - aPinned;

      // Then by sort preference
      switch (sortOrder) {
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "title-asc":
          return (a.title || a.videoId).localeCompare(b.title || b.videoId);
        case "title-desc":
          return (b.title || b.videoId).localeCompare(a.title || a.videoId);
        case "channel": {
          const aCh = a.videoMetadata?.channelName ?? "";
          const bCh = b.videoMetadata?.channelName ?? "";
          return aCh.localeCompare(bCh) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [history, searchText, sortOrder]);

  const defaultAI = getDefaultAIAction();
  const customActions = getCustomActions();

  const rowActions = (entry: HistoryEntry) => {
    const askAction = (
      <Action.Push
        key="ask"
        title="Ask AI About This Transcript"
        icon={Icon.Stars}
        target={<TranscriptAskView entry={entry} />}
        shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
      />
    );
    const summarizeAction = (
      <Action.Push
        key="summarize"
        title="Summarize Transcript with AI"
        icon={Icon.Stars}
        target={<TranscriptSummaryView entry={entry} />}
        shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
      />
    );

    return (
    <ActionPanel>
      {entry.status === "finished" ? (
        <>
          {summarizeAction}
          {customActions.map((ca, idx) => (
            <Action.Push
              key={`custom-${idx}`}
              title={ca.name}
              icon={Icon.Stars}
              target={
                <TranscriptCustomActionView
                  entry={entry}
                  actionName={ca.name}
                  promptTemplate={ca.prompt}
                />
              }
            />
          ))}
          {askAction}
          {hasAiChats(entry) && (
            <Action.Push
              key="ai-chats"
              title="View AI Chats"
              icon={Icon.Stars}
              target={<AiChatsView entry={entry} />}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
          )}
          <Action.Push
            title="View Transcript"
            icon={Icon.Sidebar}
            target={
              <TranscriptDetailView
                entry={entry}
                onRetry={() => retryFetch(entry)}
              />
            }
          />
          <Action.Push
            title="Search in Transcript"
            icon={Icon.MagnifyingGlass}
            target={<TranscriptSearchView entry={entry} />}
            shortcut={{ modifiers: ["cmd"], key: "f" }}
          />
          <Action.CopyToClipboard
            title="Copy Transcript"
            content={materializeOutput(entry, "text")}
          />
          <Action.CopyToClipboard
            title="Copy as Rich Text"
            icon={Icon.Clipboard}
            content={{
              html: buildRichTextHtml(entry),
              text: materializeOutput(entry, "text"),
            }}
            shortcut={{ modifiers: ["cmd", "shift"], key: "." }}
          />
          <Action.OpenInBrowser
            title="Open Video"
            url={entry.url}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
          />
          <Action
            title={entry.pinned ? "Unpin" : "Pin"}
            icon={entry.pinned ? Icon.PinDisabled : Icon.Pin}
            shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
            onAction={() => togglePinEntry(entry)}
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
          <Action.CopyToClipboard
            title="Copy Debug Log"
            content={entry.debugLog ?? "No debug data"}
          />
          <Action.OpenInBrowser
            title="Open Video"
            url={entry.url}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
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
  };

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
        ...(entry.pinned ? [{ icon: Icon.Pin }] : []),
        ...(entry.backgroundCompletedAt
          ? [{ tag: { value: "New", color: Color.Blue } }]
          : []),
        ...(() => {
          const chatCount = (entry.aiSummaries?.length ?? 0) + (entry.aiAnswers?.length ?? 0);
          return chatCount > 0
            ? [{ text: `${chatCount} chat${chatCount !== 1 ? "s" : ""}`, icon: Icon.Stars }]
            : [];
        })(),
        {
          icon: statusAccessory(entry).icon,
          tooltip: statusAccessory(entry).tooltip,
        },
      ]}
      actions={rowActions(entry)}
    />
  );

  if (autoNav) {
    switch (autoNav.target) {
      case "summary":
        return <TranscriptSummaryView entry={autoNav.entry} />;
      case "ask":
        return <TranscriptAskView entry={autoNav.entry} />;
      case "ai-chats":
        return <AiChatsView entry={autoNav.entry} />;
    }
  }

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
      ) : (() => {
        const pinnedItems = filteredHistory.filter((e) => e.pinned);
        const unpinnedItems = filteredHistory.filter((e) => !e.pinned);

        // Group by channel when sorted by channel
        if (sortOrder === "channel" && pinnedItems.length === 0) {
          const groups = new Map<string, HistoryEntry[]>();
          for (const entry of filteredHistory) {
            const channel = entry.videoMetadata?.channelName ?? "Unknown";
            const existing = groups.get(channel) ?? [];
            existing.push(entry);
            groups.set(channel, existing);
          }
          return Array.from(groups.entries()).map(([channel, entries]) => (
            <List.Section key={channel} title={channel} subtitle={`${entries.length} transcript${entries.length !== 1 ? "s" : ""}`}>
              {entries.map(renderItem)}
            </List.Section>
          ));
        }

        if (pinnedItems.length === 0) {
          return filteredHistory.map(renderItem);
        }

        return (
          <>
            <List.Section title="Pinned">
              {pinnedItems.map(renderItem)}
            </List.Section>
            <List.Section title="Recent">
              {unpinnedItems.map(renderItem)}
            </List.Section>
          </>
        );
      })()}
    </List>
  );
}
