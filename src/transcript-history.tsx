import {
  Action,
  ActionPanel,
  Clipboard,
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
import { HistoryEntry } from "./types";

export default function Command() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    setIsLoading(true);
    const entries = await loadHistory();
    setHistory(entries);
    setIsLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function sendToAIChat(entry: HistoryEntry) {
    await Clipboard.copy(entry.output);

    const launchCandidates = [
      { ownerOrAuthorName: "raycast", extensionName: "raycast-ai", name: "ai-chat" },
      { ownerOrAuthorName: "raycast", extensionName: "ai", name: "ai-chat" },
    ];

    for (const candidate of launchCandidates) {
      try {
        await launchCommand({
          ...candidate,
          type: LaunchType.UserInitiated,
          fallbackText: entry.output,
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
            title={entry.videoId}
            subtitle={`${entry.language ?? "auto"} • ${entry.format} • ${entry.segmentCount} segments`}
            accessories={[{ text: new Date(entry.createdAt).toLocaleString() }]}
            detail={<List.Item.Detail markdown={`# ${entry.videoId}\n\n${"```"}${entry.format}\n${entry.output}\n${"```"}`} />}
            actions={
              <ActionPanel>
                <Action title="Send to AI Chat" icon={Icon.Stars} onAction={() => sendToAIChat(entry)} />
                <Action.CopyToClipboard title="Copy Output" content={entry.output} />
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
