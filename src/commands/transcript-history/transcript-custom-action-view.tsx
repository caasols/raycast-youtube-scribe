import {
  Action,
  ActionPanel,
  Detail,
  Icon,
} from "@raycast/api";
import { useAI } from "@raycast/utils";
import { useEffect, useRef, useState } from "react";
import type { CachedAiAnswer, HistoryEntry } from "../../types";
import { buildCustomActionPrompt } from "./transcript-ai";
import { getAiModel } from "../../lib/preferences";
import {
  findCachedAnswer,
  loadFreshEntry,
  saveAnswer,
} from "../../lib/ai-cache";
import { sanitizeFilename } from "../../lib/export";
import { SaveToFileAction } from "../shared/save-to-file-action";

type GenerateMode = "initial" | "replace" | "append";

function CustomActionGenerator({
  entry,
  actionName,
  promptTemplate,
  mode,
  onComplete,
}: {
  entry: HistoryEntry;
  actionName: string;
  promptTemplate: string;
  mode: GenerateMode;
  onComplete: (answer: string) => void;
}) {
  const prompt = buildCustomActionPrompt(entry, promptTemplate);
  const modelValue = getAiModel();
  const { data, error, isLoading } = useAI(prompt, {
    creativity: "low",
    stream: true,
    ...(modelValue
      ? { model: modelValue as unknown as import("@raycast/api").AI.Model }
      : {}),
  });

  const savedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && data && !error && !savedRef.current) {
      savedRef.current = true;
      const saveMode = mode === "initial" ? "append" : mode;
      saveAnswer(entry.id, entry.aiAnswers, actionName, data, saveMode).then(
        () => onComplete(data),
      );
    }
  }, [isLoading, data, error, entry.id]);

  const body = error
    ? `**Error:** ${error.message}`
    : data || `_Running ${actionName}..._`;

  return (
    <Detail
      navigationTitle={actionName}
      isLoading={isLoading}
      markdown={`# ${actionName}\n\n${body}`}
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

function CachedCustomActionDetail({
  entry,
  actionName,
  cached,
  onRefresh,
  onNew,
}: {
  entry: HistoryEntry;
  actionName: string;
  cached: CachedAiAnswer;
  onRefresh: () => void;
  onNew: () => void;
}) {
  return (
    <Detail
      navigationTitle={actionName}
      markdown={`# ${actionName}\n\n${cached.answer}`}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Response"
            content={cached.answer}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <SaveToFileAction title={entry.title} content={cached.answer} suffix={sanitizeFilename(actionName)} />
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
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
        </ActionPanel>
      }
    />
  );
}

export function TranscriptCustomActionView({
  entry,
  actionName,
  promptTemplate,
}: {
  entry: HistoryEntry;
  actionName: string;
  promptTemplate: string;
}) {
  const [generating, setGenerating] = useState<false | GenerateMode>(false);
  const [displayContent, setDisplayContent] = useState<string | undefined>(
    () => findCachedAnswer(entry, actionName)?.answer,
  );
  const [freshEntry, setFreshEntry] = useState(entry);

  useEffect(() => {
    loadFreshEntry(entry.id).then((loaded) => {
      if (!loaded) return;
      setFreshEntry(loaded);
      const cached = findCachedAnswer(loaded, actionName);
      if (cached && !displayContent) {
        setDisplayContent(cached.answer);
      }
    });
  }, [entry.id, actionName]);

  if (!displayContent || generating) {
    return (
      <CustomActionGenerator
        entry={freshEntry}
        actionName={actionName}
        promptTemplate={promptTemplate}
        mode={generating || "initial"}
        onComplete={(answer) => {
          setDisplayContent(answer);
          setGenerating(false);
        }}
      />
    );
  }

  const cached = findCachedAnswer(freshEntry, actionName);

  return (
    <CachedCustomActionDetail
      entry={freshEntry}
      actionName={actionName}
      cached={
        cached ?? { question: actionName, answer: displayContent, createdAt: "" }
      }
      onRefresh={() => setGenerating("replace")}
      onNew={() => setGenerating("append")}
    />
  );
}
