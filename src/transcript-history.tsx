import {
  Action,
  ActionPanel,
  Clipboard,
  Color,
  Icon,
  LaunchType,
  List,
  Grid,
  Detail,
  LocalStorage,
  LaunchProps,
  Toast,
  confirmAlert,
  launchCommand,
  showToast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { clearHistory, loadHistory, saveHistory } from "./history-store";
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
  const durationMs = Math.max(0, last.start_ms + last.duration_ms - first.start_ms);
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
  if (!entry.rawSegments || entry.rawSegments.length === 0) {
    return entry.output;
  }

  if (mode === "json") {
    return JSON.stringify(entry.rawSegments, null, 2);
  }

  return entry.rawSegments
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
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

function detailMarkdown(entry: HistoryEntry, mode: OutputFormat) {
  const metadata = [
    `- **Status:** ${statusAccessory(entry).text}`,
    `- **Language:** ${entry.language ?? "auto"}`,
    `- **Segments:** ${entry.segmentCount}`,
    `- **Saved:** ${new Date(entry.createdAt).toLocaleString()}`,
    `- **View mode:** ${mode.toUpperCase()}`,
    `- **URL:** ${entry.url}`,
  ].join("\n");

  if (entry.status === "fetching") {
    return `# ${entry.title}\n\n${metadata}\n\n---\n\n## Processing\nStill fetching transcript...\n\n## Debug log\n\n\
\
\
${entry.debugLog ?? "No debug data"}\n\
\
\
`;
  }

  if (entry.status === "error") {
    return `# ${entry.title}\n\n${metadata}\n\n---\n\n## Error log\n\n\
\
\
${entry.errorLog ?? "Unknown error"}\n\
\
\
\n## Debug log\n\n\
\
\
${entry.debugLog ?? "No debug data"}\n\
\
\
`;
  }

  const output = outputForMode(entry, mode);
  return `# ${entry.title}\n\n${metadata}\n\n---\n\n## Transcript\n\n\
\
\
${output}\n\
\
\
\n## Debug log\n\n\
\
\
${entry.debugLog ?? "No debug data"}\n\
\
\
`;
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
}: {
  entry: HistoryEntry;
  mode: OutputFormat;
  onSummarize: () => void;
  onSendToAIChat: () => void;
}) {
  return (
    <Detail
      markdown={detailMarkdown(entry, mode)}
      actions={
        <ActionPanel>
          <Action title="Send to AI Chat" icon={Icon.Stars} onAction={onSendToAIChat} />
          {entry.status === "finished" ? (
            <>
              <Action title="Summarize Transcript" icon={Icon.BulletPoints} onAction={onSummarize} />
              <Action.CopyToClipboard title="Copy Output" content={outputForMode(entry, mode)} />
              <Action.Push title="Search in Transcript" icon={Icon.MagnifyingGlass} target={<TranscriptSearchView entry={entry} />} />
            </>
          ) : null}
          <Action.CopyToClipboard title="Copy Debug Log" content={entry.debugLog ?? "No debug data"} />
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
        </ActionPanel>
      }
    />
  );
}

type Arguments = { videoId?: string };

export default function Command(props: LaunchProps<{ arguments: Arguments }>) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<OutputFormat>("text");
  const [searchText, setSearchText] = useState(props.arguments.videoId ?? "");

  async function setAndPersistViewMode(mode: OutputFormat) {
    setViewMode(mode);
    await LocalStorage.setItem(VIEW_MODE_KEY, mode);
  }

  async function refresh() {
    setIsLoading(true);
    const entries = await loadHistory();
    setHistory(entries);
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
      { ownerOrAuthorName: "raycast", extensionName: "raycast-ai", name: "send-text-to-ai-chat" },
      { ownerOrAuthorName: "raycast", extensionName: "ai", name: "send-text-to-ai-chat" },
      { ownerOrAuthorName: "raycast", extensionName: "raycast-ai", name: "ai-chat" },
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
          title: mode === "summarize" ? "Summarizing in AI Chat" : "Sent to AI Chat",
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

  async function removeEntry(id: string) {
    const next = history.filter((entry) => entry.id !== id);
    setHistory(next);
    await saveHistory(next);
    await showToast({ style: Toast.Style.Success, title: "Removed from history" });
  }

  async function removeAll() {
    const ok = await confirmAlert({
      title: "Clear transcript history?",
      message: "This removes all previously fetched transcripts from local history.",
      primaryAction: { title: "Clear", style: Action.Style.Destructive },
    });

    if (!ok) return;

    await clearHistory();
    setHistory([]);
    await showToast({ style: Toast.Style.Success, title: "History cleared" });
  }

  const filteredHistory = useMemo(() => {
    if (!searchText.trim()) return history;
    return history.filter((entry) => fuzzyMatch(entry.title || entry.videoId, searchText));
  }, [history, searchText]);

  const rowActions = (entry: HistoryEntry) => (
    <ActionPanel>
      <Action
        title="Send to AI Chat"
        icon={Icon.Stars}
        onAction={() => sendToAIChat(entry)}
        shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
      />
      <Action.Push
        title="Open Details"
        icon={Icon.Sidebar}
        target={
          <TranscriptDetailView
            entry={entry}
            mode={viewMode}
            onSummarize={() => summarizeTranscript(entry)}
            onSendToAIChat={() => sendToAIChat(entry)}
          />
        }
      />
      {entry.status === "finished" ? (
        <>
          <Action
            title="Summarize Transcript"
            icon={Icon.BulletPoints}
            onAction={() => summarizeTranscript(entry)}
            shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
          />
          <Action.CopyToClipboard title="Copy Output" content={outputForMode(entry, viewMode)} />
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
          <Action.CopyToClipboard title="Copy Debug Log" content={entry.debugLog ?? "No debug data"} />
        </>
      ) : (
        <>
          <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={refresh} />
          <Action.CopyToClipboard title="Copy Debug Log" content={entry.debugLog ?? "No debug data"} />
        </>
      )}
      <Action.OpenInBrowser title="Open Video" url={entry.url} shortcut={{ modifiers: ["cmd"], key: "o" }} />
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
      {entry.status === "finished" ? <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={refresh} /> : null}
    </ActionPanel>
  );

  const renderItem = (entry: HistoryEntry) => (
    <Grid.Item
      key={entry.id}
      content={{ source: videoThumbnailUrl(entry.videoId), fallback: Icon.Video }}
      title={rowTitle(entry)}
      subtitle={rowMetadata(entry)}
      accessories={[{ text: statusEmoji(entry), tooltip: statusAccessory(entry).tooltip }]}
      actions={rowActions(entry)}
    />
  );

  return (
    <Grid
      isLoading={isLoading}
      filtering={false}
      searchBarPlaceholder="Search video titles (fuzzy)"
      searchText={searchText}
      onSearchTextChange={setSearchText}
    >
      {filteredHistory.length === 0 ? (
        <Grid.EmptyView
          icon={Icon.Clock}
          title="No history yet"
          description="Run 'Get YouTube Transcript' first. This command shows all transcripts fetched previously."
        />
      ) : (
        filteredHistory.map(renderItem)
      )}
    </Grid>
  );
}
