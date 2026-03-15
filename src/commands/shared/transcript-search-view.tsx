import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useMemo, useState } from "react";
import { materializeOutput } from "../../lib/output";
import {
  buildTranscriptChunks,
  buildTranscriptSearchSnippet,
  findTranscriptSearchMatches,
  formatTranscriptTimestamp,
  highlightTranscriptText,
} from "../../lib/transcript-search";
import type { HistoryEntry } from "../../types";

export function TranscriptSearchView({ entry }: { entry: HistoryEntry }) {
  const [query, setQuery] = useState("");

  const segments = entry.rawSegments ?? [];
  const chunks = useMemo(() => buildTranscriptChunks(segments), [segments]);
  const matches = useMemo(
    () => findTranscriptSearchMatches(chunks, query),
    [chunks, query],
  );

  const hasQuery = query.trim().length > 0;

  return (
    <List
      searchText={query}
      onSearchTextChange={setQuery}
      filtering={false}
      isShowingDetail={hasQuery}
      searchBarPlaceholder="Search transcript (fuzzy, timeline order)"
    >
      {matches.map((chunk) => (
        <List.Item
          key={`${entry.id}-${chunk.id}`}
          icon={Icon.TextDocument}
          title={
            hasQuery
              ? buildTranscriptSearchSnippet(chunk.text, query)
              : chunk.text
          }
          accessories={
            hasQuery
              ? undefined
              : [{ text: formatTranscriptTimestamp(chunk.start_ms) }]
          }
          detail={
            hasQuery ? (
              <List.Item.Detail
                markdown={`**${formatTranscriptTimestamp(chunk.start_ms)}**\n\n${highlightTranscriptText(chunk.text, query)}`}
              />
            ) : undefined
          }
          actions={
            <ActionPanel>
              <Action.CopyToClipboard
                title="Copy Segment"
                content={chunk.text}
              />
              <Action.CopyToClipboard
                title="Copy Transcript"
                content={materializeOutput(entry, "text")}
              />
              <Action.OpenInBrowser
                title="Open Video at Timestamp"
                url={`${entry.url}&t=${Math.floor(chunk.start_ms / 1000)}`}
                shortcut={{ modifiers: ["cmd"], key: "o" }}
              />
              <Action.OpenInBrowser title="Open Video" url={entry.url} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
