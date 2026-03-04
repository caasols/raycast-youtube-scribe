import {
  Action,
  ActionPanel,
  Clipboard,
  Color,
  Icon,
  LaunchType,
  List,
  Toast,
  confirmAlert,
  launchCommand,
  showToast,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { clearHistory, loadHistory, saveHistory } from "./history-store";
import { HistoryEntry, OutputFormat } from "./types";

function statusAccessory(entry: HistoryEntry) {
  if (entry.status === "finished") {
    return { icon: { source: Icon.CircleFilled, tintColor: Color.Green }, tooltip: "Transcript ready" };
  }

  if (entry.status === "fetching") {
    return { icon: { source: Icon.CircleFilled, tintColor: Color.Orange }, tooltip: "Still fetching" };
  }

  return { icon: { source: Icon.CircleFilled, tintColor: Color.Red }, tooltip: "Fetch failed" };
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

function detailMarkdown(entry: HistoryEntry, mode: OutputFormat) {
  if (entry.status === "fetching") {
    return `# ${entry.title}\n\nStill fetching transcript...`;
  }

  if (entry.status === "error") {
    return `# ${entry.title}\n\n## Error log\n\n\`\`\`\n${entry.errorLog ?? "Unknown error"}\n\`\`\``;
  }

  const output = outputForMode(entry, mode);
  return `# ${entry.title}\n\n\`\`\`${mode}\n${output}\n\`\`\``;
}

export default function Command() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<OutputFormat>("text");

  async function refresh() {
    setIsLoading(true);
    const entries = await loadHistory();
    setHistory(entries);
    setIsLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!history.some((entry) => entry.status === "fetching")) return;

    const timer = setInterval(() => {
      refresh();
    }, 1500);

    return () => clearInterval(timer);
  }, [history]);

  async function sendToAIChat(entry: HistoryEntry) {
    const output = outputForMode(entry, viewMode);
    await Clipboard.copy(output);

    const launchCandidates = [
      { ownerOrAuthorName: "raycast", extensionName: "raycast-ai", name: "ai-chat" },
      { ownerOrAuthorName: "raycast", extensionName: "ai", name: "ai-chat" },
    ];

    for (const candidate of launchCandidates) {
      try {
        await launchCommand({
          ...candidate,
          type: LaunchType.UserInitiated,
          fallbackText: output,
        });

        await showToast({
          style: Toast.Style.Success,
          title: "Sent to AI Chat",
          message: "Transcript copied and AI Chat opened",
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

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search previously fetched transcripts">
      {history.length === 0 ? (
        <List.EmptyView
          icon={Icon.Clock}
          title="No history yet"
          description="Run 'Get YouTube Transcript' first. This command shows all transcripts fetched previously."
        />
      ) : (
        history.map((entry) => (
          <List.Item
            key={entry.id}
            icon={Icon.TextDocument}
            title={entry.title || entry.videoId}
            subtitle={`${entry.language ?? "auto"} • ${viewMode} view • ${entry.segmentCount} segments`}
            accessories={[statusAccessory(entry), { text: new Date(entry.createdAt).toLocaleString() }]}
            detail={<List.Item.Detail markdown={detailMarkdown(entry, viewMode)} />}
            actions={
              <ActionPanel>
                {entry.status === "finished" ? (
                  <>
                    <Action title="Send to AI Chat" icon={Icon.Stars} onAction={() => sendToAIChat(entry)} />
                    <Action.CopyToClipboard title="Copy Output" content={outputForMode(entry, viewMode)} />
                    <Action
                      title="View as Text"
                      icon={Icon.AlignLeft}
                      onAction={() => setViewMode("text")}
                      shortcut={{ modifiers: ["cmd"], key: "1" }}
                    />
                    <Action
                      title="View as JSON"
                      icon={Icon.Code}
                      onAction={() => setViewMode("json")}
                      shortcut={{ modifiers: ["cmd"], key: "2" }}
                    />
                  </>
                ) : null}
                <Action.OpenInBrowser title="Open Video" url={entry.url} />
                <Action
                  title="Remove from History"
                  style={Action.Style.Destructive}
                  icon={Icon.Trash}
                  onAction={() => removeEntry(entry.id)}
                />
                <Action
                  title="Clear All History"
                  style={Action.Style.Destructive}
                  icon={Icon.Trash}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
                  onAction={removeAll}
                />
                <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={refresh} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
