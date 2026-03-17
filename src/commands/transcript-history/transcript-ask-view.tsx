import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  List,
  Toast,
  showToast,
} from "@raycast/api";
import { useAI } from "@raycast/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HistoryEntry } from "../../types";
import {
  buildSuggestedTranscriptQuestions,
  buildTranscriptQuestionPrompt,
  updateRecentTranscriptQuestions,
} from "./transcript-ai";
import {
  loadTranscriptAskHistory,
  saveTranscriptAskHistory,
} from "./transcript-ask-history";
import { patchHistoryEntry } from "../../history-store";
import { sanitizeFilename, saveToDownloads } from "../../lib/export";

function TranscriptAnswerView({
  entry,
  question,
}: {
  entry: HistoryEntry;
  question: string;
}) {
  const prompt = buildTranscriptQuestionPrompt(entry, question);
  const { data, error, isLoading, revalidate } = useAI(prompt, {
    creativity: "low",
    stream: true,
  });

  const savedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && data && !error && !savedRef.current) {
      savedRef.current = true;
      patchHistoryEntry(entry.id, { aiSummary: data });
    }
  }, [isLoading, data, error, entry.id]);

  const body = error
    ? `**Error:** ${error.message}`
    : data || "_Generating answer..._";

  const markdown = `# ${question}

${body}`;

  return (
    <Detail
      navigationTitle={question}
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Answer" content={data || ""} />
          <Action
            title="Save Answer to File"
            icon={Icon.SaveDocument}
            onAction={async () => {
              if (!data) return;
              try {
                const filename = `${sanitizeFilename(entry.title)}-answer.md`;
                const path = await saveToDownloads(filename, data);
                await showToast({
                  style: Toast.Style.Success,
                  title: "Saved",
                  message: path,
                });
              } catch (err) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Save failed",
                  message: err instanceof Error ? err.message : "Unknown error.",
                });
              }
            }}
          />
          <Action
            title="Retry Question"
            icon={Icon.ArrowClockwise}
            onAction={revalidate}
          />
          <Action.CopyToClipboard title="Copy Prompt" content={prompt} />
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
        </ActionPanel>
      }
    />
  );
}

export function TranscriptAskView({ entry }: { entry: HistoryEntry }) {
  const [question, setQuestion] = useState<string>();
  const [searchText, setSearchText] = useState("");
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const trimmedQuestion = searchText.trim();
  const suggestedQuestions = useMemo(
    () => buildSuggestedTranscriptQuestions(entry),
    [entry],
  );

  useEffect(() => {
    async function bootstrap() {
      setRecentQuestions(await loadTranscriptAskHistory());
    }

    bootstrap();
  }, []);

  if (question) {
    return <TranscriptAnswerView entry={entry} question={question} />;
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

  return (
    <List
      filtering={false}
      searchBarPlaceholder="Ask about this transcript..."
      searchText={searchText}
      onSearchTextChange={setSearchText}
    >
      <List.Item
        icon={Icon.Stars}
        title="Ask AI About Transcript"
        subtitle={trimmedQuestion || "Type a question in the search bar above"}
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
              icon={Icon.Clock}
              title={item}
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
            icon={Icon.Stars}
            title={item}
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
