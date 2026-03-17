import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  Toast,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { TranscriptSearchView } from "./transcript-search-view";
import { buildHistoryDetailMarkdown } from "../../lib/history-detail";
import { buildDiagnosticReport } from "../../lib/diagnostics";
import {
  exportTranscript,
  buildExportFilename,
  saveToDownloads,
  sanitizeFilename,
} from "../../lib/export";
import { isRetryable } from "../../lib/error-classification";
import type { HistoryEntry, ExportFormat } from "../../types";
import { TranscriptSummaryView } from "../transcript-history/transcript-summary-view";
import { TranscriptAskView } from "../transcript-history/transcript-ask-view";
import { getDefaultAIAction } from "../../lib/preferences";

export function TranscriptDetailView({
  entry,
  onRetry,
  onOpenHistory,
}: {
  entry: HistoryEntry;
  onRetry?: () => void;
  onOpenHistory?: () => Promise<void>;
}) {
  const defaultAI = getDefaultAIAction();

  const askAction = (
    <Action.Push
      key="ask"
      title="Ask AI About Transcript"
      icon={Icon.Stars}
      target={<TranscriptAskView entry={entry} />}
      shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
    />
  );
  const summarizeAction = (
    <Action.Push
      key="summarize"
      title="Summarize Transcript"
      icon={Icon.BulletPoints}
      target={<TranscriptSummaryView entry={entry} />}
      shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
    />
  );

  return (
    <Detail
      markdown={buildHistoryDetailMarkdown(entry, "text", {
        surface: "full-detail",
      })}
      actions={
        <ActionPanel>
          {entry.status === "finished" && (
            <>
              {defaultAI === "summarize" ? summarizeAction : askAction}
              {defaultAI === "summarize" ? askAction : summarizeAction}
              <ActionPanel.Submenu title="Export" icon={Icon.Download}>
                {(
                  [
                    ["plain", "Copy as Plain Text"],
                    ["readable", "Copy as Readable Text"],
                    ["json", "Copy as JSON"],
                    ["srt", "Copy as SRT"],
                  ] as [ExportFormat, string][]
                ).map(([format, title]) => (
                  <Action.CopyToClipboard
                    key={`copy-${format}`}
                    title={title}
                    content={exportTranscript(entry, format)}
                  />
                ))}
                {(
                  [
                    ["plain", "Save as Plain Text"],
                    ["readable", "Save as Readable Text"],
                    ["json", "Save as JSON"],
                    ["srt", "Save as SRT"],
                  ] as [ExportFormat, string][]
                ).map(([format, title]) => (
                  <Action
                    key={`save-${format}`}
                    title={title}
                    icon={Icon.SaveDocument}
                    onAction={async () => {
                      try {
                        await saveToDownloads(
                          buildExportFilename(entry, format),
                          exportTranscript(entry, format),
                        );
                        await showToast({
                          style: Toast.Style.Success,
                          title: "Saved",
                          message: buildExportFilename(entry, format),
                        });
                      } catch (err) {
                        await showToast({
                          style: Toast.Style.Failure,
                          title: "Save failed",
                          message:
                            err instanceof Error ? err.message : String(err),
                        });
                      }
                    }}
                  />
                ))}
                {entry.aiSummary && (
                  <>
                    <Action.CopyToClipboard
                      title="Copy AI Summary"
                      content={entry.aiSummary}
                    />
                    <Action
                      title="Save AI Summary to File"
                      icon={Icon.SaveDocument}
                      onAction={async () => {
                        const filename = `${sanitizeFilename(entry.title)}-summary.md`;
                        try {
                          await saveToDownloads(filename, entry.aiSummary!);
                          await showToast({
                            style: Toast.Style.Success,
                            title: "Saved",
                            message: filename,
                          });
                        } catch (err) {
                          await showToast({
                            style: Toast.Style.Failure,
                            title: "Save failed",
                            message:
                              err instanceof Error ? err.message : String(err),
                          });
                        }
                      }}
                    />
                  </>
                )}
              </ActionPanel.Submenu>
              <Action.Push
                title="Search in Transcript"
                icon={Icon.MagnifyingGlass}
                target={<TranscriptSearchView entry={entry} />}
              />
            </>
          )}
          {entry.status === "error" && (
            <>
              {onRetry && isRetryable(entry.errorKind ?? "unknown") && (
                <Action
                  title="Retry Fetch"
                  icon={Icon.ArrowClockwise}
                  onAction={onRetry}
                />
              )}
              {entry.errorKind === "auth-required" && (
                <Action
                  title="Open Extension Preferences"
                  icon={Icon.Gear}
                  onAction={openExtensionPreferences}
                />
              )}
              {entry.errorKind === "ytdlp-missing" && (
                <Action.CopyToClipboard
                  title="Copy Install Command"
                  content="brew install yt-dlp"
                />
              )}
            </>
          )}
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
          {onOpenHistory && (
            <Action
              title="View Transcript History"
              icon={Icon.Clock}
              onAction={onOpenHistory}
            />
          )}
          <Action.CopyToClipboard
            title="Copy Diagnostic Report"
            content={buildDiagnosticReport(entry)}
            shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
          />
          <Action.CopyToClipboard
            title="Copy Debug Log"
            content={entry.debugLog ?? "No debug data"}
          />
        </ActionPanel>
      }
    />
  );
}
