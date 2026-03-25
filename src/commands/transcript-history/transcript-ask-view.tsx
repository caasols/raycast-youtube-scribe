import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  List,
} from "@raycast/api";
import { useAI } from "@raycast/utils";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { CachedAiAnswer, HistoryEntry } from "../../types";
import {
  buildSuggestedTranscriptQuestions,
  buildTranscriptQuestionPrompt,
  updateRecentTranscriptQuestions,
} from "./transcript-ai";
import {
  loadTranscriptAskHistory,
  saveTranscriptAskHistory,
} from "./transcript-ask-history";
import {
  findCachedAnswer,
  loadFreshEntry,
  saveAnswer,
} from "../../lib/ai-cache";
import { getAiModel } from "../../lib/preferences";
import { SaveToFileAction } from "../shared/save-to-file-action";

const LazySummaryView = lazy(() =>
  import("./transcript-summary-view").then((m) => ({
    default: m.TranscriptSummaryView,
  })),
);

function JumpToSummary({ entry }: { entry: HistoryEntry }) {
  return (
    <Suspense fallback={<Detail isLoading markdown="" />}>
      <LazySummaryView entry={entry} />
    </Suspense>
  );
}

type GenerateMode = "initial" | "replace" | "append";

function AnswerGenerator({
  entry,
  question,
  mode,
  onComplete,
}: {
  entry: HistoryEntry;
  question: string;
  mode: GenerateMode;
  onComplete: (answer: string) => void;
}) {
  const prompt = buildTranscriptQuestionPrompt(entry, question);
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
      const saveMode = mode === "initial" ? "append" : mode;
      saveAnswer(entry.id, entry.aiAnswers, question, data, saveMode).then(
        () => onComplete(data),
      );
    }
  }, [isLoading, data, error, entry.id]);

  const body = error
    ? `**Error:** ${error.message}`
    : data || "_Generating answer..._";

  const markdown = `# ${question}\n\n${body}`;

  return (
    <Detail
      navigationTitle={question}
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Response"
            content={data || ""}
          />
          <Action.CopyToClipboard title="Copy Prompt" content={prompt} />
          <Action.Push
            title="Summarize Transcript with AI"
            icon={Icon.Stars}
            target={<JumpToSummary entry={entry} />}
            shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
          />
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
        </ActionPanel>
      }
    />
  );
}

function CachedAnswerDetail({
  entry,
  question,
  cached,
  onRefresh,
  onNew,
}: {
  entry: HistoryEntry;
  question: string;
  cached: CachedAiAnswer;
  onRefresh: () => void;
  onNew: () => void;
}) {
  const markdown = `# ${question}\n\n${cached.answer}`;

  return (
    <Detail
      navigationTitle={question}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Response"
            content={cached.answer}
          />
          <SaveToFileAction title={entry.title} content={cached.answer} suffix="answer" />
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
            title="Summarize Transcript with AI"
            icon={Icon.Stars}
            target={<JumpToSummary entry={entry} />}
            shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
          />
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
        </ActionPanel>
      }
    />
  );
}

function TranscriptAnswerView({
  entry,
  question,
}: {
  entry: HistoryEntry;
  question: string;
}) {
  const [generating, setGenerating] = useState<false | GenerateMode>(false);
  const [displayContent, setDisplayContent] = useState<string | undefined>(
    () => findCachedAnswer(entry, question)?.answer,
  );
  const [freshEntry, setFreshEntry] = useState(entry);

  // Load fresh entry from storage on mount to pick up cached data
  useEffect(() => {
    loadFreshEntry(entry.id).then((loaded) => {
      if (!loaded) return;
      setFreshEntry(loaded);
      const cached = findCachedAnswer(loaded, question);
      if (cached && !displayContent) {
        setDisplayContent(cached.answer);
      }
    });
  }, [entry.id, question]);

  if (!displayContent || generating) {
    return (
      <AnswerGenerator
        entry={freshEntry}
        question={question}
        mode={generating || "initial"}
        onComplete={(answer) => {
          setDisplayContent(answer);
          setGenerating(false);
        }}
      />
    );
  }

  const cached = findCachedAnswer(freshEntry, question);

  return (
    <CachedAnswerDetail
      entry={freshEntry}
      question={question}
      cached={cached ?? { question, answer: displayContent, createdAt: "" }}
      onRefresh={() => setGenerating("replace")}
      onNew={() => setGenerating("append")}
    />
  );
}

export function TranscriptAskView({
  entry,
  initialQuestion,
}: {
  entry: HistoryEntry;
  initialQuestion?: string;
}) {
  const [question, setQuestion] = useState<string | undefined>(initialQuestion);
  const [searchText, setSearchText] = useState("");
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const [freshEntry, setFreshEntry] = useState(entry);
  const trimmedQuestion = searchText.trim();
  const suggestedQuestions = useMemo(
    () => buildSuggestedTranscriptQuestions(entry),
    [entry],
  );

  useEffect(() => {
    async function bootstrap() {
      setRecentQuestions(await loadTranscriptAskHistory());
      const loaded = await loadFreshEntry(entry.id);
      if (loaded) setFreshEntry(loaded);
    }

    bootstrap();
  }, []);

  if (question) {
    return <TranscriptAnswerView entry={freshEntry} question={question} />;
  }

  async function startQuestion(nextQuestion: string) {
    const normalized = nextQuestion.trim();
    if (!normalized) return;

    const nextHistory = updateRecentTranscriptQuestions(
      recentQuestions,
      normalized,
    );
    setRecentQuestions(nextHistory);
    await saveTranscriptAskHistory(nextHistory);
    setQuestion(normalized);
  }

  function hasCachedAnswer(q: string): boolean {
    return !!findCachedAnswer(freshEntry, q);
  }

  return (
    <List
      filtering={false}
      searchBarPlaceholder="Ask about this transcript..."
      searchText={searchText}
      onSearchTextChange={setSearchText}
    >
      <List.Item
        icon={Icon.Stars}
        title="Ask AI About This Transcript"
        subtitle={trimmedQuestion || "Type your question above"}
        actions={
          <ActionPanel>
            <Action
              title="Ask AI"
              icon={Icon.Stars}
              onAction={() => startQuestion(trimmedQuestion)}
            />
          </ActionPanel>
        }
      />
      {recentQuestions.length > 0 ? (
        <List.Section title="History">
          {recentQuestions.map((item) => (
            <List.Item
              key={`history-${item}`}
              icon={hasCachedAnswer(item) ? Icon.CheckCircle : Icon.Clock}
              title={item}
              accessories={
                hasCachedAnswer(item)
                  ? [{ tag: { value: "Saved" }, icon: Icon.CheckCircle }]
                  : []
              }
              actions={
                <ActionPanel>
                  <Action
                    title="Ask AI"
                    icon={Icon.Stars}
                    onAction={() => startQuestion(item)}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}
      <List.Section title="Suggested Questions">
        {suggestedQuestions.map((item) => (
          <List.Item
            key={`suggested-${item}`}
            icon={hasCachedAnswer(item) ? Icon.CheckCircle : Icon.Stars}
            title={item}
            accessories={
              hasCachedAnswer(item)
                ? [{ tag: { value: "Saved" }, icon: Icon.CheckCircle }]
                : []
            }
            actions={
              <ActionPanel>
                <Action
                  title="Ask AI"
                  icon={Icon.Stars}
                  onAction={() => startQuestion(item)}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
