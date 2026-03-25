import {
  Action,
  ActionPanel,
  Clipboard,
  Detail,
  Form,
  Icon,
  LaunchProps,
  LaunchType,
  LocalStorage,
  Toast,
  launchCommand,
  showToast,
} from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";
import { useEffect, useMemo, useState } from "react";
import {
  loadHistory,
  patchHistoryEntryAndMoveToFront,
  patchHistoryEntry,
  prependHistory,
} from "./history-store";
import { getFocusedTabContext, getFocusedYoutubeUrl } from "./lib/browser";
import { getFetchCompletionDestination } from "./lib/fetch-navigation";
import { shouldCopyEntryOutput } from "./lib/history-logic";
import { getInitialLaunchMode } from "./lib/launch-mode";
import { getLoadingStateMarkdown } from "./lib/loading-state";
import { consumeRetryTranscriptIntent } from "./lib/navigation-intents";
import { materializeOutput } from "./lib/output";
import { fetchTranscriptWithYtDlp, findYtDlp } from "./lib/ytdlp";
import {
  extractYoutubeUrlFromText,
  normalizeInput,
  normalizeLanguage,
} from "./lib/youtube";
import { getAutoSummarize } from "./lib/preferences";
import { HistoryEntry } from "./types";
import { TranscriptDetailView } from "./commands/shared/transcript-detail-view";
import {
  PreparedTranscriptBackgroundTask,
  prepareTranscriptJob,
  runPreparedTranscriptJob,
} from "./commands/get-youtube-transcript/transcript-job";
import { preparePlaylistJob } from "./commands/get-youtube-transcript/playlist-job";
import { detectYoutubeInputKind } from "./lib/youtube";

type Arguments = {
  language?: string;
};

type FormValues = {
  videoInput: string;
  language: string;
};

type UiMode = "detecting" | "fetching" | "opening" | "manual-form" | "detail";

async function yieldToRenderer() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return videoId;
    const data = (await response.json()) as { title?: string };
    return normalizeInput(data.title) || videoId;
  } catch {
    return videoId;
  }
}

async function openHistory() {
  await launchCommand({
    ownerOrAuthorName: "caasols",
    extensionName: "youtube-transcribe",
    name: "transcript-history",
    type: LaunchType.UserInitiated,
  });
}

function showCachedEntryToast(entry: HistoryEntry): Promise<Toast> {
  return showToast({
    style:
      entry.status === "finished"
        ? Toast.Style.Success
        : entry.status === "fetching"
          ? Toast.Style.Animated
          : Toast.Style.Failure,
    title:
      entry.status === "finished"
        ? "Transcript already cached"
        : entry.status === "fetching"
          ? "Transcript fetch already in progress"
          : "Transcript fetch failed",
    message:
      entry.status === "finished"
        ? "Opened transcript details."
        : "Opened transcript history.",
  });
}

function launchTranscriptWorker(task: PreparedTranscriptBackgroundTask): void {
  void launchCommand({
    ownerOrAuthorName: "caasols",
    extensionName: "youtube-transcribe",
    name: "fetch-youtube-transcript-worker",
    type: LaunchType.Background,
    context: { task },
  }).catch(() => {
    // Fire-and-forget: if the worker fails to launch, the foreground
    // will still complete the fetch as long as the user stays in Raycast.
  });
}

function launchPlaylistWorker(
  task: import("./commands/get-youtube-transcript/playlist-job").PlaylistBackgroundTask,
): void {
  void launchCommand({
    ownerOrAuthorName: "caasols",
    extensionName: "youtube-transcribe",
    name: "fetch-playlist-worker",
    type: LaunchType.Background,
    context: { task },
  }).catch(() => {});
}

function launchAutoSummarize(entry: HistoryEntry): void {
  if (!getAutoSummarize()) return;
  if (entry.status !== "finished") return;
  if (entry.aiSummaries?.length) return; // Already has a summary

  void patchHistoryEntry(entry.id, { aiSummarizationStatus: "generating" });
  void launchCommand({
    ownerOrAuthorName: "caasols",
    extensionName: "youtube-transcribe",
    name: "ai-summarize-worker",
    type: LaunchType.Background,
    context: { task: { entryId: entry.id, title: entry.title } },
  }).catch(() => {});
}

export default function Command(props: LaunchProps<{ arguments: Arguments }>) {
  const [isLoading, setIsLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [uiMode, setUiMode] = useState<UiMode>("detecting");
  const [detailEntry, setDetailEntry] = useState<HistoryEntry | undefined>();

  const defaults = useMemo(
    () => ({
      videoInput: "",
      language: normalizeLanguage(props.arguments.language),
    }),
    [props.arguments.language],
  );

  const transcriptJobDeps = useMemo(
    () => ({
      readClipboardText: () => Clipboard.readText(),
      getFocusedYoutubeUrl,
      getFocusedTabContext,
      loadHistory,
      prependHistory,
      patchHistoryEntry,
      patchHistoryEntryAndMoveToFront,
      fetchVideoTitle,
      findYtDlp,
      fetchTranscriptWithYtDlp,
    }),
    [],
  );

  const { handleSubmit, itemProps } = useForm<FormValues>({
    initialValues: defaults,
    onSubmit: async (values) => {
      setIsLoading(true);
      try {
        // Check if input is a playlist URL
        if (detectYoutubeInputKind(values.videoInput.trim()) === "playlist") {
          const result = await preparePlaylistJob(
            values.videoInput.trim(),
            values.language,
            transcriptJobDeps,
          );
          launchPlaylistWorker(result.backgroundTask);
          const queued = result.entries.length;
          const skipped = result.skippedCount;
          const msg = skipped > 0
            ? `Queued ${queued} videos (${skipped} already cached)`
            : `Queued ${queued} videos`;
          await showToast({
            style: Toast.Style.Success,
            title: msg,
            message: result.playlistInfo.playlistTitle,
          });
          await openHistory();
          return;
        }

        const { entry, fromCache, backgroundTask } = await prepareTranscriptJob(
          values.videoInput,
          values.language,
          transcriptJobDeps,
        );

        if (shouldCopyEntryOutput(entry)) {
          await Clipboard.copy(materializeOutput(entry, "text"));
        }

        if (fromCache) {
          if (getFetchCompletionDestination(entry) === "detail") {
            setDetailEntry(entry);
            setUiMode("detail");
          } else {
            await openHistory();
          }

          await showCachedEntryToast(entry);
          return;
        }

        launchTranscriptWorker(backgroundTask!);

        const finished = await runPreparedTranscriptJob(backgroundTask!, {
          findYtDlp,
          fetchTranscriptWithYtDlp,
          patchHistoryEntry,
        });

        if (shouldCopyEntryOutput(finished)) {
          await Clipboard.copy(materializeOutput(finished, "text"));
        }

        launchAutoSummarize(finished);
        setDetailEntry(finished);
        setUiMode("detail");
        await showToast({
          style: Toast.Style.Success,
          title: "Transcript ready",
          message: `Opened transcript details • ${finished.segmentCount} segments • ${finished.language ?? "auto"}.`,
        });
        return;
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch transcript",
          message: error instanceof Error ? error.message : "Unknown error.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    validation: {
      videoInput: FormValidation.Required,
    },
  });

  useEffect(() => {
    async function maybeRunFromArgs() {
      if (bootstrapped) return;
      setBootstrapped(true);

      const retryPayload = await consumeRetryTranscriptIntent({
        getItem: (key) => LocalStorage.getItem<string>(key),
        removeItem: (key) => LocalStorage.removeItem(key),
      });

      const clipboardText = await Clipboard.readText();
      const hasAutoUrl = Boolean(
        extractYoutubeUrlFromText(clipboardText ?? undefined),
      );

      let hasFocusedTab = false;
      if (!hasAutoUrl) {
        try {
          hasFocusedTab = Boolean(getFocusedYoutubeUrl().url);
        } catch {
          hasFocusedTab = false;
        }
      }

      const launchMode = getInitialLaunchMode({
        hasLanguageArgument: Boolean(defaults.language),
        hasClipboardUrl: Boolean(retryPayload?.url) || hasAutoUrl,
        hasFocusedYoutubeTab: hasFocusedTab,
      });

      if (launchMode === "manual-form") {
        setUiMode("manual-form");
        return;
      }

      setUiMode("fetching");
      setIsLoading(true);
      try {
        // Check if auto-detected URL is a playlist
        const autoInput = retryPayload?.url ?? defaults.videoInput;
        const autoUrl = extractYoutubeUrlFromText(autoInput) ?? autoInput;
        if (detectYoutubeInputKind(autoUrl) === "playlist") {
          const result = await preparePlaylistJob(
            autoUrl,
            retryPayload?.language ?? defaults.language,
            transcriptJobDeps,
          );
          launchPlaylistWorker(result.backgroundTask);
          const queued = result.entries.length;
          const skipped = result.skippedCount;
          const msg = skipped > 0
            ? `Queued ${queued} videos (${skipped} already cached)`
            : `Queued ${queued} videos`;
          await showToast({
            style: Toast.Style.Success,
            title: msg,
            message: result.playlistInfo.playlistTitle,
          });
          await openHistory();
          return;
        }

        const { entry, fromCache, backgroundTask } = await prepareTranscriptJob(
          retryPayload?.url ?? defaults.videoInput,
          retryPayload?.language ?? defaults.language,
          transcriptJobDeps,
        );

        if (shouldCopyEntryOutput(entry)) {
          await Clipboard.copy(materializeOutput(entry, "text"));
        }

        if (fromCache) {
          if (getFetchCompletionDestination(entry) === "detail") {
            setUiMode("opening");
            await yieldToRenderer();
            setDetailEntry(entry);
            setUiMode("detail");
          } else {
            await openHistory();
          }

          await showCachedEntryToast(entry);
          return;
        }

        launchTranscriptWorker(backgroundTask!);

        const finished = await runPreparedTranscriptJob(backgroundTask!, {
          findYtDlp,
          fetchTranscriptWithYtDlp,
          patchHistoryEntry,
        });

        if (shouldCopyEntryOutput(finished)) {
          await Clipboard.copy(materializeOutput(finished, "text"));
        }

        launchAutoSummarize(finished);
        setUiMode("opening");
        await yieldToRenderer();
        setDetailEntry(finished);
        setUiMode("detail");
        await showToast({
          style: Toast.Style.Success,
          title: "Transcript ready",
          message: `Opened transcript details • ${finished.segmentCount} segments • ${finished.language ?? "auto"}.`,
        });
        return;
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch transcript",
          message: error instanceof Error ? error.message : "Unknown error.",
        });
      } finally {
        setIsLoading(false);
      }
    }

    maybeRunFromArgs();
  }, [bootstrapped, defaults.language, defaults.videoInput, transcriptJobDeps]);

  if (uiMode !== "manual-form") {
    if (uiMode === "detail" && detailEntry) {
      return (
        <TranscriptDetailView entry={detailEntry} onOpenHistory={openHistory} />
      );
    }

    const loadingMarkdown = getLoadingStateMarkdown(
      uiMode === "detecting" || uiMode === "fetching" || uiMode === "opening"
        ? uiMode
        : "detecting",
    );

    return <Detail isLoading={true} markdown={loadingMarkdown} />;
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Fetch Transcript"
            icon={Icon.Download}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="No YouTube source was auto-detected. Paste a video URL or ID here. Requires a local `yt-dlp` install." />
      <Form.TextField
        title="YouTube URL or Video ID"
        placeholder="Paste a YouTube URL or video ID"
        {...itemProps.videoInput}
      />
      <Form.TextField
        title="Language"
        placeholder="Optional, e.g. en, pt, es"
        {...itemProps.language}
      />
    </Form>
  );
}
