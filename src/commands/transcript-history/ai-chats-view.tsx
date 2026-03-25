import {
  Action,
  ActionPanel,
  Alert,
  Detail,
  Icon,
  List,
  Toast,
  confirmAlert,
  showToast,
} from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import type {
  CachedAiAnswer,
  CachedAiSummary,
  HistoryEntry,
} from "../../types";
import { sanitizeFilename, saveToDownloads } from "../../lib/export";
import {
  clearAllAiChats,
  deleteAnswer,
  deleteSummary,
  loadFreshEntry,
  saveAnswer,
  togglePin,
} from "../../lib/ai-cache";
import { TranscriptAskView } from "./transcript-ask-view";
import { buildFollowUpQuestionPrompt } from "./transcript-ai";
import { useAI } from "@raycast/utils";
import { countWords, readingTimeLabel } from "../../lib/text-utils";
import { getAiModel } from "../../lib/preferences";

export type AiChatItem =
  | { kind: "summary"; data: CachedAiSummary }
  | { kind: "answer"; data: CachedAiAnswer };

function buildChatItems(entry: HistoryEntry): AiChatItem[] {
  const items: AiChatItem[] = [];

  for (const s of entry.aiSummaries ?? []) {
    items.push({ kind: "summary", data: s });
  }

  // Separate root answers and follow-ups
  const rootAnswers: CachedAiAnswer[] = [];
  const followUps = new Map<string, CachedAiAnswer[]>();

  for (const a of entry.aiAnswers ?? []) {
    if (a.parentCreatedAt) {
      const existing = followUps.get(a.parentCreatedAt) ?? [];
      existing.push(a);
      followUps.set(a.parentCreatedAt, existing);
    } else {
      rootAnswers.push(a);
    }
  }

  for (const a of rootAnswers) {
    items.push({ kind: "answer", data: a });
    // Insert follow-ups immediately after their parent
    const children = followUps.get(a.createdAt);
    if (children) {
      for (const child of children.sort(
        (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime(),
      )) {
        items.push({ kind: "answer", data: child });
      }
    }
  }

  // Sort root-level groups by pinned first, then by date descending
  // But preserve parent→child ordering within threads
  const threadOrder = new Map<string, number>();
  let orderIdx = 0;
  for (const item of items) {
    if (item.kind === "summary" || !(item.data as CachedAiAnswer).parentCreatedAt) {
      orderIdx++;
    }
    threadOrder.set(item.data.createdAt, orderIdx);
  }

  items.sort((a, b) => {
    const aThread = threadOrder.get(a.data.createdAt) ?? 0;
    const bThread = threadOrder.get(b.data.createdAt) ?? 0;

    // Pinned items bubble their entire thread up
    const aPinned = a.data.pinned ? 1 : 0;
    const bPinned = b.data.pinned ? 1 : 0;
    if (bPinned !== aPinned) return bPinned - aPinned;

    // Different threads: sort by thread creation time (descending)
    if (aThread !== bThread) return aThread - bThread;

    // Same thread: sort by creation time (ascending) to show parent before children
    return new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime();
  });

  return items;
}

export function chatItemTitle(item: AiChatItem): string {
  return item.kind === "summary" ? "Summary" : item.data.question;
}

export function chatItemContent(item: AiChatItem): string {
  return item.kind === "summary" ? item.data.content : item.data.answer;
}

function FollowUpGenerator({
  entry,
  previousQuestion,
  previousAnswer,
  followUpQuestion,
  parentCreatedAt,
}: {
  entry: HistoryEntry;
  previousQuestion: string;
  previousAnswer: string;
  followUpQuestion: string;
  parentCreatedAt: string;
}) {
  const prompt = buildFollowUpQuestionPrompt(
    entry,
    previousQuestion,
    previousAnswer,
    followUpQuestion,
  );
  const modelValue = getAiModel();
  const { data, error, isLoading } = useAI(prompt, {
    creativity: "low",
    stream: true,
    ...(modelValue ? { model: modelValue as unknown as import("@raycast/api").AI.Model } : {}),
  });

  const savedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && data && !error && !savedRef.current) {
      savedRef.current = true;
      saveAnswer(entry.id, entry.aiAnswers, followUpQuestion, data, "append", parentCreatedAt);
    }
  }, [isLoading, data, error]);

  const body = error
    ? `**Error:** ${error.message}`
    : data || "_Generating answer..._";

  return (
    <Detail
      navigationTitle={followUpQuestion}
      isLoading={isLoading}
      markdown={`# ${followUpQuestion}\n\n${body}`}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Response"
            content={data || ""}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
        </ActionPanel>
      }
    />
  );
}

function FollowUpAskView({
  entry,
  previousQuestion,
  previousAnswer,
  parentCreatedAt,
}: {
  entry: HistoryEntry;
  previousQuestion: string;
  previousAnswer: string;
  parentCreatedAt: string;
}) {
  const [followUp, setFollowUp] = useState<string>();
  const [searchText, setSearchText] = useState("");

  if (followUp) {
    return (
      <FollowUpGenerator
        entry={entry}
        previousQuestion={previousQuestion}
        previousAnswer={previousAnswer}
        followUpQuestion={followUp}
        parentCreatedAt={parentCreatedAt}
      />
    );
  }

  return (
    <List
      filtering={false}
      searchBarPlaceholder="Ask a follow-up question..."
      searchText={searchText}
      onSearchTextChange={setSearchText}
    >
      <List.Item
        icon={Icon.Stars}
        title="Ask Follow-Up"
        subtitle={searchText.trim() || "Type your follow-up question above"}
        actions={
          <ActionPanel>
            <Action
              title="Ask AI"
              icon={Icon.Stars}
              onAction={() => {
                const q = searchText.trim();
                if (q) setFollowUp(q);
              }}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}

export function AiChatDetail({
  entry,
  item,
}: {
  entry: HistoryEntry;
  item: AiChatItem;
}) {
  const title = chatItemTitle(item);
  const content = chatItemContent(item);
  const words = countWords(content);
  const statsLine = words > 0 ? `\`${words.toLocaleString()} words\` \`${readingTimeLabel(words)}\`\n\n` : "";
  const markdown = `# ${title}\n\n${statsLine}${content}`;

  return (
    <Detail
      navigationTitle={title}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Response"
            content={content}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action.CopyToClipboard
            title="Copy as Markdown"
            content={markdown}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
          {item.kind === "answer" && (
            <Action.Push
              title="Ask Follow-Up"
              icon={Icon.Stars}
              shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
              target={
                <FollowUpAskView
                  entry={entry}
                  previousQuestion={(item.data as CachedAiAnswer).question}
                  previousAnswer={(item.data as CachedAiAnswer).answer}
                  parentCreatedAt={item.data.createdAt}
                />
              }
            />
          )}
          <Action
            title="Save to File"
            icon={Icon.SaveDocument}
            onAction={async () => {
              try {
                const suffix =
                  item.kind === "summary" ? "summary" : "answer";
                const filename = `${sanitizeFilename(entry.title)}-${suffix}.md`;
                const path = await saveToDownloads(filename, content);
                await showToast({
                  style: Toast.Style.Success,
                  title: "Saved",
                  message: path,
                });
              } catch (err) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Save failed",
                  message:
                    err instanceof Error ? err.message : "Unknown error.",
                });
              }
            }}
          />
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
        </ActionPanel>
      }
    />
  );
}

export function hasAiChats(entry: HistoryEntry): boolean {
  return (
    (entry.aiSummaries?.length ?? 0) > 0 ||
    (entry.aiAnswers?.length ?? 0) > 0
  );
}

export function AiChatsView({ entry }: { entry: HistoryEntry }) {
  const [freshEntry, setFreshEntry] = useState(entry);

  useEffect(() => {
    loadFreshEntry(entry.id).then((loaded) => {
      if (loaded) setFreshEntry(loaded);
    });
  }, [entry.id]);

  const items = buildChatItems(freshEntry);

  function buildExportMarkdown(): string {
    const lines: string[] = [`# AI Chats: ${freshEntry.title}\n`];
    for (const item of items) {
      const heading =
        item.kind === "summary" ? "## Summary" : `## Q: ${(item.data as CachedAiAnswer).question}`;
      const content = chatItemContent(item);
      const date = new Date(item.data.createdAt).toLocaleString();
      lines.push(`${heading}\n\n${content}\n\n*Generated: ${date}*\n\n---\n`);
    }
    return lines.join("\n");
  }

  async function handleExportAll() {
    try {
      const markdown = buildExportMarkdown();
      const filename = `${sanitizeFilename(freshEntry.title)}-ai-chats.md`;
      const path = await saveToDownloads(filename, markdown);
      await showToast({ style: Toast.Style.Success, title: "Exported", message: path });
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Export failed",
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }

  async function reloadEntry() {
    const loaded = await loadFreshEntry(entry.id);
    if (loaded) setFreshEntry(loaded);
  }

  async function handleTogglePin(item: AiChatItem) {
    await togglePin(entry.id, item.kind, item.data.createdAt);
    await reloadEntry();
    await showToast({
      style: Toast.Style.Success,
      title: item.data.pinned ? "Unpinned" : "Pinned",
    });
  }

  async function handleClearAll() {
    if (
      await confirmAlert({
        title: "Clear All AI Chats",
        message: "This will delete all summaries and answers for this transcript.",
        primaryAction: { title: "Clear All", style: Alert.ActionStyle.Destructive },
      })
    ) {
      await clearAllAiChats(entry.id);
      await reloadEntry();
      await showToast({ style: Toast.Style.Success, title: "All AI chats cleared" });
    }
  }

  async function handleDelete(item: AiChatItem) {
    if (
      await confirmAlert({
        title: "Delete AI Chat",
        message: `Are you sure you want to delete this ${item.kind}?`,
        primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
      })
    ) {
      if (item.kind === "summary") {
        await deleteSummary(entry.id, item.data.createdAt);
      } else {
        await deleteAnswer(entry.id, item.data.createdAt);
      }
      await reloadEntry();
      await showToast({ style: Toast.Style.Success, title: "Deleted" });
    }
  }

  return (
    <List navigationTitle="AI Chats">
      {items.map((item, idx) => {
        const isFollowUp = item.kind === "answer" && Boolean((item.data as CachedAiAnswer).parentCreatedAt);
        const title = chatItemTitle(item);
        const displayTitle = isFollowUp ? `↳ ${title}` : title;
        const date = new Date(item.data.createdAt);
        const dateStr = date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <List.Item
            key={`${item.kind}-${idx}`}
            icon={isFollowUp ? Icon.ArrowRight : item.kind === "summary" ? Icon.BulletPoints : Icon.QuestionMarkCircle}
            title={displayTitle}
            accessories={[
              ...(item.data.pinned ? [{ icon: Icon.Pin }] : []),
              { text: `${countWords(chatItemContent(item))}w` },
              { text: dateStr },
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="View Response"
                  icon={Icon.Eye}
                  target={<AiChatDetail entry={freshEntry} item={item} />}
                />
                {item.kind === "answer" && (
                  <Action.Push
                    title="Ask Again"
                    icon={Icon.ArrowClockwise}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
                    target={<TranscriptAskView entry={freshEntry} initialQuestion={(item.data as CachedAiAnswer).question} />}
                  />
                )}
                {item.kind === "answer" && (
                  <Action.Push
                    title="Ask Follow-Up"
                    icon={Icon.Stars}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
                    target={
                      <FollowUpAskView
                        entry={freshEntry}
                        previousQuestion={(item.data as CachedAiAnswer).question}
                        previousAnswer={(item.data as CachedAiAnswer).answer}
                        parentCreatedAt={item.data.createdAt}
                      />
                    }
                  />
                )}
                <Action
                  title="Export All AI Chats"
                  icon={Icon.Download}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
                  onAction={handleExportAll}
                />
                <Action
                  title={item.data.pinned ? "Unpin" : "Pin"}
                  icon={item.data.pinned ? Icon.PinDisabled : Icon.Pin}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
                  onAction={() => handleTogglePin(item)}
                />
                <Action
                  title="Delete"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["ctrl"], key: "x" }}
                  onAction={() => handleDelete(item)}
                />
                <Action
                  title="Clear All AI Chats"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
                  onAction={handleClearAll}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
