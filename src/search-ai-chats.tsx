import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { loadHistory } from "./history-store";
import type { HistoryEntry } from "./types";
import {
  AiChatDetail,
  AiChatItem,
  chatItemContent,
  chatItemTitle,
} from "./commands/transcript-history/ai-chats-view";

type SearchableItem = {
  entry: HistoryEntry;
  item: AiChatItem;
};

function buildAllItems(entries: HistoryEntry[]): SearchableItem[] {
  const results: SearchableItem[] = [];

  for (const entry of entries) {
    for (const s of entry.aiSummaries ?? []) {
      results.push({ entry, item: { kind: "summary", data: s } });
    }
    for (const a of entry.aiAnswers ?? []) {
      results.push({ entry, item: { kind: "answer", data: a } });
    }
  }

  results.sort(
    (a, b) =>
      new Date(b.item.data.createdAt).getTime() -
      new Date(a.item.data.createdAt).getTime(),
  );

  return results;
}

export default function Command() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory().then((loaded) => {
      setEntries(loaded);
      setIsLoading(false);
    });
  }, []);

  const allItems = useMemo(() => buildAllItems(entries), [entries]);

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={true}
      filtering={true}
      searchBarPlaceholder="Search AI chats..."
    >
      {allItems.length === 0 ? (
        <List.EmptyView
          icon={Icon.Stars}
          title="No AI chats yet"
          description="Use 'Summarize Transcript with AI' or 'Ask AI About This Transcript' from any transcript to get started."
        />
      ) : (
        allItems.map((searchable, idx) => {
          const title = chatItemTitle(searchable.item);
          const content = chatItemContent(searchable.item);
          const videoTitle = searchable.entry.title ?? searchable.entry.videoId;
          const date = new Date(searchable.item.data.createdAt);
          const dateStr = date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <List.Item
              key={`${searchable.entry.id}-${searchable.item.kind}-${idx}`}
              icon={
                searchable.item.kind === "summary"
                  ? Icon.BulletPoints
                  : Icon.QuestionMarkCircle
              }
              title={title}
              subtitle={videoTitle}
              keywords={[videoTitle, title, content]}
              accessories={[{ text: dateStr }]}
              detail={
                <List.Item.Detail markdown={`# ${title}\n\n${content}`} />
              }
              actions={
                <ActionPanel>
                  <Action.Push
                    title="View Response"
                    icon={Icon.Eye}
                    target={
                      <AiChatDetail
                        entry={searchable.entry}
                        item={searchable.item}
                      />
                    }
                  />
                  <Action.CopyToClipboard
                    title="Copy Response"
                    content={content}
                  />
                  <Action.OpenInBrowser
                    title="Open Video"
                    url={searchable.entry.url}
                  />
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
