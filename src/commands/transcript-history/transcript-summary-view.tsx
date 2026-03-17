import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  Toast,
  showToast,
} from "@raycast/api";
import { useAI } from "@raycast/utils";
import { useEffect, useRef } from "react";
import type { HistoryEntry } from "../../types";
import { buildTranscriptSummaryPrompt } from "./transcript-ai";
import { getSummarizePromptTemplate } from "../../lib/preferences";
import { patchHistoryEntry } from "../../history-store";
import { sanitizeFilename, saveToDownloads } from "../../lib/export";

export function TranscriptSummaryView({ entry }: { entry: HistoryEntry }) {
  const prompt = buildTranscriptSummaryPrompt(
    entry,
    getSummarizePromptTemplate(),
  );
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

  useEffect(() => {
    savedRef.current = false;
  }, [prompt]);

  const title = entry.title ?? entry.videoId;
  const body = error
    ? `**Error:** ${error.message}`
    : data || "_Generating summary..._";

  const markdown = `# ${title}

${body}`;

  return (
    <Detail
      navigationTitle="Summary"
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Summary"
            content={data || ""}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action
            title="Save Summary to File"
            icon={Icon.SaveDocument}
            onAction={async () => {
              if (!data) return;
              try {
                const filename = `${sanitizeFilename(entry.title)}-summary.md`;
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
            title="Retry Summary"
            icon={Icon.ArrowClockwise}
            onAction={revalidate}
          />
          <Action.CopyToClipboard
            title="Copy Prompt"
            content={prompt}
          />
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
        </ActionPanel>
      }
    />
  );
}
