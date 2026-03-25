import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  LaunchType,
  launchCommand,
} from "@raycast/api";
import { useAI } from "@raycast/utils";
import { useEffect, useRef, useState } from "react";
import type { CachedAiSummary, HistoryEntry } from "../../types";
import { buildTranscriptSummaryPrompt } from "./transcript-ai";
import { getAiModel, getSummarizePromptTemplate } from "../../lib/preferences";
import {
  findCachedSummary,
  loadFreshEntry,
  saveSummary,
} from "../../lib/ai-cache";
import { patchHistoryEntry } from "../../history-store";
import { TranscriptAskView } from "./transcript-ask-view";
import { SaveToFileAction } from "../shared/save-to-file-action";

type GenerateMode = "initial" | "replace" | "append";

function SummaryGenerator({
  entry,
  mode,
  onComplete,
}: {
  entry: HistoryEntry;
  mode: GenerateMode;
  onComplete: (content: string) => void;
}) {
  const prompt = buildTranscriptSummaryPrompt(
    entry,
    getSummarizePromptTemplate(),
  );
  const modelValue = getAiModel();
  const { data, error, isLoading } = useAI(prompt, {
    creativity: "low",
    stream: true,
    ...(modelValue ? { model: modelValue as unknown as import("@raycast/api").AI.Model } : {}),
  });

  const savedRef = useRef(false);
  const launchedWorkerRef = useRef(false);

  // Mark as generating and launch background worker on mount
  useEffect(() => {
    if (launchedWorkerRef.current) return;
    launchedWorkerRef.current = true;

    patchHistoryEntry(entry.id, { aiSummarizationStatus: "generating" });
    void launchCommand({
      ownerOrAuthorName: "caasols",
      extensionName: "youtube-transcribe",
      name: "ai-summarize-worker",
      type: LaunchType.Background,
      context: { task: { entryId: entry.id, title: entry.title } },
    }).catch(() => {
      // Fire-and-forget: if the worker fails to launch, the foreground
      // will still complete as long as the user stays in Raycast.
    });
  }, []);

  useEffect(() => {
    if (!isLoading && data && !error && !savedRef.current) {
      savedRef.current = true;
      const saveMode = mode === "initial" ? "append" : mode;
      saveSummary(entry.id, entry.aiSummaries, data, saveMode).then(() => {
        patchHistoryEntry(entry.id, { aiSummarizationStatus: undefined });
        onComplete(data);
      });
    }
  }, [isLoading, data, error, entry.id]);

  const title = entry.title ?? entry.videoId;
  const body = error
    ? `**Error:** ${error.message}`
    : data || "_Generating summary..._";

  const markdown = `# ${title}\n\n${body}`;

  return (
    <Detail
      navigationTitle="Summary"
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Response"
            content={data || ""}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action.CopyToClipboard title="Copy Prompt" content={prompt} />
          <Action.Push
            title="Ask AI About This Transcript"
            icon={Icon.Stars}
            target={<TranscriptAskView entry={entry} />}
            shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
          />
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
        </ActionPanel>
      }
    />
  );
}

function CachedSummaryDetail({
  entry,
  cached,
  onRefresh,
  onNew,
}: {
  entry: HistoryEntry;
  cached: CachedAiSummary;
  onRefresh: () => void;
  onNew: () => void;
}) {
  const title = entry.title ?? entry.videoId;
  const markdown = `# ${title}\n\n${cached.content}`;

  return (
    <Detail
      navigationTitle="Summary"
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Response"
            content={cached.content}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <SaveToFileAction title={entry.title} content={cached.content} suffix="summary" />
          <Action
            title="Refresh Response"
            icon={Icon.ArrowClockwise}
            onAction={onRefresh}
          />
          <Action
            title="New Response"
            icon={Icon.PlusCircle}
            onAction={onNew}
          />
          <Action.Push
            title="Ask AI About This Transcript"
            icon={Icon.Stars}
            target={<TranscriptAskView entry={entry} />}
            shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
          />
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
        </ActionPanel>
      }
    />
  );
}

export function TranscriptSummaryView({ entry }: { entry: HistoryEntry }) {
  const [generating, setGenerating] = useState<false | GenerateMode>(false);
  const [displayContent, setDisplayContent] = useState<string | undefined>(
    () => findCachedSummary(entry)?.content,
  );
  const [freshEntry, setFreshEntry] = useState(entry);

  // Load fresh entry from storage on mount to pick up cached data
  // that the stale prop doesn't have.
  useEffect(() => {
    loadFreshEntry(entry.id).then((loaded) => {
      if (!loaded) return;
      setFreshEntry(loaded);
      const cached = findCachedSummary(loaded);
      if (cached && !displayContent) {
        setDisplayContent(cached.content);
      }
    });
  }, [entry.id]);

  if (!displayContent || generating) {
    return (
      <SummaryGenerator
        entry={freshEntry}
        mode={generating || "initial"}
        onComplete={(content) => {
          setDisplayContent(content);
          setGenerating(false);
        }}
      />
    );
  }

  const cached = findCachedSummary(freshEntry);

  return (
    <CachedSummaryDetail
      entry={freshEntry}
      cached={cached ?? { content: displayContent, createdAt: "" }}
      onRefresh={() => setGenerating("replace")}
      onNew={() => setGenerating("append")}
    />
  );
}
