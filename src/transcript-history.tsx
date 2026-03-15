import {
  Action,
  ActionPanel,
  Clipboard,
  Color,
  Icon,
  LaunchType,
  List,
  Detail,
  LocalStorage,
  Toast,
  confirmAlert,
  launchCommand,
  showToast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { clearHistory, loadHistory, saveHistory } from "./history-store";
import { buildHistoryDetailMarkdown } from "./lib/history-detail";
import { matchesHistoryQuery } from "./lib/history-logic";
import {
  findFocusedHistoryEntry,
  HISTORY_FOCUS_ENTRY_KEY,
  reconcileFocusedHistoryEntry,
  shouldConsumeHistoryFocusRequest,
} from "./lib/history-navigation";
import { materializeOutput } from "./lib/output";
import { HistoryEntry, OutputFormat } from "./types";

const VIEW_MODE_KEY = "transcript-history-view-mode";

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
  if (entry.status === "finished") {
    return {
      icon: { source: Icon.CircleFilled, tintColor: Color.Green },
      text: "Ready",
      tooltip: "Transcript ready",
    };
  }

  if (entry.status === "fetching") {
    return {
      icon: { source: Icon.CircleFilled, tintColor: Color.Orange },
      text: "Fetching",
      tooltip: "Still fetching",
    };
  }

  return {
    icon: { source: Icon.CircleFilled, tintColor: Color.Red },
    text: "Failed",
    tooltip: "Fetch failed",
  };
}

function statusEmoji(entry: HistoryEntry) {
  if (entry.status === "finished") return "🟢";
  if (entry.status === "fetching") return "🟠";
  return "🔴";
}

function videoThumbnailUrl(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

function durationLabel(entry: HistoryEntry) {
  const segments = entry.rawSegments ?? [];
  if (segments.length === 0) return "--:--";

  const first = segments[0];
  const last = segments[segments.length - 1];
  const durationMs = Math.max(
    0,
    last.start_ms + last.duration_ms - first.start_ms,
  );
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function rowMetadata(entry: HistoryEntry) {
  return `You • ${durationLabel(entry)} • ${formatWhen(entry.createdAt)}`;
}

function rowTitle(entry: HistoryEntry) {
  return entry.title || entry.videoId;
}

function rowDetailMarkdown(entry: HistoryEntry) {
  return [
    `# ${rowTitle(entry)}`,
    "",
    `- **Metadata:** ${rowMetadata(entry)}`,
    `- **Status:** ${statusAccessory(entry).text} ${statusEmoji(entry)}`,
    `- **Language:** ${entry.language ?? "auto"}`,
    `- **Segments:** ${entry.segmentCount}`,
    `- **Saved:** ${new Date(entry.createdAt).toLocaleString()}`,
    `- **URL:** ${entry.url}`,
  ].join("\n");
}

function outputForMode(entry: HistoryEntry, mode: OutputFormat): string {
  return materializeOutput(entry, mode);
}

function formatWhen(createdAt: string) {
  const date = new Date(createdAt);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;

  return date.toLocaleDateString();
}

function TranscriptSearchView({ entry }: { entry: HistoryEntry }) {
  const [query, setQuery] = useState("");

  const segments = entry.rawSegments ?? [];
  const matches = useMemo(() => {
    if (!query.trim()) return segments.slice(0, 200);
    return segments.filter((s) => fuzzyMatch(s.text, query));
  }, [segments, query]);

  return (
    <List
      searchText={query}
      onSearchTextChange={setQuery}
      isLoading={false}
      filtering={false}
      searchBarPlaceholder="Search inside transcript (fuzzy)"
    >
      {matches.map((segment, idx) => (
        <List.Item
          key={`${entry.id}-${idx}-${segment.start_ms}`}
          icon={Icon.TextDocument}
          title={segment.text}
          accessories={[{ text: `${Math.round(segment.start_ms / 1000)}s` }]}
        />
      ))}
    </List>
  );
}

function TranscriptDetailView({
  entry,
  mode,
  onSummarize,
  onSendToAIChat,
  onRetry,
}: {
  entry: HistoryEntry;
  mode: OutputFormat;
  onSummarize: () => void;
  onSendToAIChat: () => void;
  onRetry: () => void;
}) {
  return (
    <Detail
      markdown={buildHistoryDetailMarkdown(entry, mode)}
      actions={
        <ActionPanel>
          {entry.status === "finished" ? (
            <>
              <Action
                title="Send to AI Chat"
                icon={Icon.Stars}
                onAction={onSendToAIChat}
              />
              <Action
                title="Summarize Transcript"
                icon={Icon.BulletPoints}
                onAction={onSummarize}
              />
              <Action.CopyToClipboard
                title="Copy Output"
                content={outputForMode(entry, mode)}
              />
              <Action.Push
                title="Search in Transcript"
                icon={Icon.MagnifyingGlass}
                target={<TranscriptSearchView entry={entry} />}
              />
            </>
          ) : (
            <Action
              title="Retry Fetch"
              icon={Icon.ArrowClockwise}
              onAction={onRetry}
            />
          )}
          <Action.CopyToClipboard
            title="Copy Debug Log"
            content={entry.debugLog ?? "No debug data"}
          />
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [focusedEntry, setFocusedEntry] = useState<HistoryEntry | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<OutputFormat>("text");
  const [searchText, setSearchText] = useState("");

  async function setAndPersistViewMode(mode: OutputFormat) {
    setViewMode(mode);
    await LocalStorage.setItem(VIEW_MODE_KEY, mode);
  }

  async function refresh() {
    setIsLoading(true);
    const entries = await loadHistory();
    const requestedFocusEntryId = await LocalStorage.getItem<string>(
      HISTORY_FOCUS_ENTRY_KEY,
    );
    const nextFocusedEntry = reconcileFocusedHistoryEntry(
      entries,
      requestedFocusEntryId,
      focusedEntry,
    );
    const requestedEntry = findFocusedHistoryEntry(
      entries,
      requestedFocusEntryId,
    );
    if (requestedFocusEntryId && requestedEntry) {
      await LocalStorage.removeItem(HISTORY_FOCUS_ENTRY_KEY);
    }

    setHistory(entries);
    setFocusedEntry(nextFocusedEntry);
    setIsLoading(false);
  }

  useEffect(() => {
    async function bootstrap() {
      const savedMode = await LocalStorage.getItem<string>(VIEW_MODE_KEY);
      if (savedMode === "text" || savedMode === "json") {
        setViewMode(savedMode);
      }
      await refresh();
    }

    bootstrap();
  }, []);

  useEffect(() => {
    const timer = setInterval(async () => {
      const requestedFocusEntryId = await LocalStorage.getItem<string>(
        HISTORY_FOCUS_ENTRY_KEY,
      );
      if (
        !shouldConsumeHistoryFocusRequest(requestedFocusEntryId, focusedEntry)
      ) {
        return;
      }

      const entries = await loadHistory();
      const nextFocusedEntry = reconcileFocusedHistoryEntry(
        entries,
        requestedFocusEntryId,
        focusedEntry,
      );
      if (!nextFocusedEntry) {
        return;
      }

      if (requestedFocusEntryId) {
        await LocalStorage.removeItem(HISTORY_FOCUS_ENTRY_KEY);
      }
      setHistory(entries);
      setFocusedEntry(nextFocusedEntry);
    }, 400);

    return () => clearInterval(timer);
  }, [focusedEntry]);

  useEffect(() => {
    if (!history.some((entry) => entry.status === "fetching")) return;

    const timer = setInterval(() => {
      refresh();
    }, 1500);

    return () => clearInterval(timer);
  }, [history]);

  async function openAIChat(entry: HistoryEntry, mode: "send" | "summarize") {
    const output = outputForMode(entry, viewMode);

    const prompt =
      mode === "summarize"
        ? `summarize the points\n\nVideo: ${entry.title}\nURL: ${entry.url}\n\nTranscript:\n${output}`
        : `Video: ${entry.title}\nURL: ${entry.url}\n\nTranscript:\n${output}`;

    await Clipboard.copy(prompt);

    const launchCandidates = [
      {
        ownerOrAuthorName: "raycast",
        extensionName: "raycast-ai",
        name: "send-text-to-ai-chat",
      },
      {
        ownerOrAuthorName: "raycast",
        extensionName: "ai",
        name: "send-text-to-ai-chat",
      },
      {
        ownerOrAuthorName: "raycast",
        extensionName: "raycast-ai",
        name: "ai-chat",
      },
      { ownerOrAuthorName: "raycast", extensionName: "ai", name: "ai-chat" },
    ];

    for (const candidate of launchCandidates) {
      try {
        await launchCommand({
          ...candidate,
          type: LaunchType.UserInitiated,
          fallbackText: prompt,
        });

        await showToast({
          style: Toast.Style.Success,
          title:
            mode === "summarize" ? "Summarizing in AI Chat" : "Sent to AI Chat",
          message: "Transcript prepared and AI Chat opened",
        });
        return;
      } catch {
        // try next candidate
      }
    }

    await showToast({
      style: Toast.Style.Success,
      title: "Transcript copied",
      message: "Could not auto-open AI Chat. Open Raycast AI Chat and paste.",
    });
  }

  async function summarizeTranscript(entry: HistoryEntry) {
    await openAIChat(entry, "summarize");
  }

  async function sendToAIChat(entry: HistoryEntry) {
    await openAIChat(entry, "send");
  }

  async function retryFetch(entry: HistoryEntry) {
    setFocusedEntry(undefined);
    await launchCommand({
      ownerOrAuthorName: "caasols",
      extensionName: "youtube-scribe",
      name: "get-youtube-transcript",
      type: LaunchType.UserInitiated,
      arguments: {
        url: entry.url,
        language: entry.language ?? "",
        format: entry.format,
      },
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
      primaryAction: { title: "Clear", style: Action.Style.Destructive },
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
      <Action.Push
        title="Open Details"
        icon={Icon.Sidebar}
        target={
          <TranscriptDetailView
            entry={entry}
            mode={viewMode}
            onSummarize={() => summarizeTranscript(entry)}
            onSendToAIChat={() => sendToAIChat(entry)}
            onRetry={() => retryFetch(entry)}
          />
        }
      />
      {entry.status === "finished" ? (
        <>
          <Action
            title="Send to AI Chat"
            icon={Icon.Stars}
            onAction={() => sendToAIChat(entry)}
            shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
          />
          <Action
            title="Summarize Transcript"
            icon={Icon.BulletPoints}
            onAction={() => summarizeTranscript(entry)}
            shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
          />
          <Action.CopyToClipboard
            title="Copy Output"
            content={outputForMode(entry, viewMode)}
          />
          <Action
            title="View as Text"
            icon={Icon.AlignLeft}
            onAction={() => setAndPersistViewMode("text")}
            shortcut={{ modifiers: ["cmd"], key: "1" }}
          />
          <Action
            title="View as JSON"
            icon={Icon.Code}
            onAction={() => setAndPersistViewMode("json")}
            shortcut={{ modifiers: ["cmd"], key: "2" }}
          />
          <Action.Push
            title="Search in Transcript"
            icon={Icon.MagnifyingGlass}
            target={<TranscriptSearchView entry={entry} />}
            shortcut={{ modifiers: ["cmd"], key: "f" }}
          />
          <Action.CopyToClipboard
            title="Copy Debug Log"
            content={entry.debugLog ?? "No debug data"}
          />
        </>
      ) : (
        <>
          <Action
            title="Retry Fetch"
            icon={Icon.ArrowClockwise}
            onAction={() => retryFetch(entry)}
          />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={refresh}
          />
          <Action.CopyToClipboard
            title="Copy Debug Log"
            content={entry.debugLog ?? "No debug data"}
          />
        </>
      )}
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
        title="Clean Entire History"
        style={Action.Style.Destructive}
        icon={Icon.Trash}
        shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
        onAction={removeAll}
      />
      {entry.status === "finished" ? (
        <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={refresh} />
      ) : null}
    </ActionPanel>
  );

  const renderItem = (entry: HistoryEntry) => (
    <List.Item
      key={entry.id}
      icon={{ source: videoThumbnailUrl(entry.videoId), fallback: Icon.Video }}
      title={rowTitle(entry)}
      detail={<List.Item.Detail markdown={rowDetailMarkdown(entry)} />}
      accessories={[
        {
          text: statusEmoji(entry),
          tooltip: statusAccessory(entry).tooltip,
        },
      ]}
      actions={rowActions(entry)}
    />
  );

  if (focusedEntry) {
    return (
      <TranscriptDetailView
        entry={focusedEntry}
        mode={viewMode}
        onSummarize={() => summarizeTranscript(focusedEntry)}
        onSendToAIChat={() => sendToAIChat(focusedEntry)}
        onRetry={() => retryFetch(focusedEntry)}
      />
    );
  }

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={true}
      filtering={false}
      searchBarPlaceholder="Search video titles (fuzzy)"
      searchText={searchText}
      onSearchTextChange={setSearchText}
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
