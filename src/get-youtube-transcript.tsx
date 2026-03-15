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
import { buildHistoryDetailMarkdown } from "./lib/history-detail";
import { getFetchCompletionDestination } from "./lib/fetch-navigation";
import { findReusableEntry, shouldCopyEntryOutput } from "./lib/history-logic";
import { getInitialLaunchMode } from "./lib/launch-mode";
import { getLoadingStateText } from "./lib/loading-state";
import { materializeOutput } from "./lib/output";
import {
  TRANSCRIPT_RETRY_PAYLOAD_KEY,
  TranscriptRetryPayload,
} from "./lib/retry-payload";
import {
  loadViewModePreferences,
  saveViewModePreference,
} from "./lib/view-mode-preferences-storage";
import { resolveViewModePreference } from "./lib/view-mode-preferences";
import { fetchTranscriptWithYtDlp, findYtDlp } from "./lib/ytdlp";
import {
  extractVideoId,
  extractYoutubeUrlFromText,
  makeFetchKey,
  normalizeInput,
  normalizeLanguage,
} from "./lib/youtube";
import { HistoryEntry } from "./types";

type Arguments = {
  language?: string;
};

type FormValues = {
  videoInput: string;
  language: string;
};

type UiMode = "bootstrapping" | "auto-running" | "manual-form" | "detail";

type DebugStep = {
  step: string;
  ok: boolean;
  details?: Record<string, unknown>;
};

type InputResolution = {
  url: string;
  source: "manual" | "clipboard" | "focused-tab";
  app?: string;
  tabTitle?: string;
  debug: DebugStep[];
};

function toDebugJson(
  context: Record<string, unknown>,
  steps: DebugStep[],
): string {
  return JSON.stringify(
    {
      at: new Date().toISOString(),
      ...context,
      steps,
    },
    null,
    2,
  );
}

function buildMissingYtDlpMessage(): string {
  return [
    "yt-dlp is not installed.",
    "Install it with `brew install yt-dlp` or `pipx install yt-dlp`, then try again.",
  ].join(" ");
}

function toTranscriptError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error("Failed to fetch transcript due to an unknown error.");
  }

  const message = error.message.trim();
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("yt-dlp is not installed")) {
    return new Error(buildMissingYtDlpMessage());
  }

  if (lowerMessage.includes("no captions found")) {
    return new Error("No transcript track is available for this video.");
  }

  if (lowerMessage.includes("sign in") || lowerMessage.includes("cookies")) {
    return new Error(
      "This video requires browser cookies or sign-in access to fetch captions.",
    );
  }

  if (
    lowerMessage.includes("private") ||
    lowerMessage.includes("video unavailable")
  ) {
    return new Error(
      "This video is unavailable (private, removed, or restricted).",
    );
  }

  if (
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("too many requests") ||
    lowerMessage.includes("http error 429")
  ) {
    return new Error(
      "YouTube is rate-limiting transcript requests right now. Please try again in a moment.",
    );
  }

  if (lowerMessage.includes("timed out")) {
    return new Error(
      "yt-dlp timed out while fetching captions. Please retry. If it keeps happening, open the debug log from history.",
    );
  }

  return new Error(message || "Failed to fetch transcript.");
}

async function resolveYoutubeInput(
  videoInput: string,
): Promise<InputResolution> {
  const debug: DebugStep[] = [];

  const manualUrl = normalizeInput(videoInput);
  if (manualUrl) {
    debug.push({
      step: "manual-input",
      ok: true,
      details: { value: manualUrl },
    });
    return { url: manualUrl, source: "manual", debug };
  }
  debug.push({ step: "manual-input", ok: false });

  const clipboardText = await Clipboard.readText();
  const clipboardUrl = extractYoutubeUrlFromText(clipboardText ?? undefined);
  if (clipboardUrl) {
    debug.push({
      step: "clipboard-scan",
      ok: true,
      details: { value: clipboardUrl },
    });
    return { url: clipboardUrl, source: "clipboard", debug };
  }
  debug.push({ step: "clipboard-scan", ok: false });

  try {
    const focused = getFocusedYoutubeUrl();
    debug.push({
      step: "focused-tab",
      ok: true,
      details: { app: focused.app, value: focused.url, title: focused.title },
    });
    return {
      url: focused.url,
      source: "focused-tab",
      app: focused.app,
      tabTitle: focused.title,
      debug,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown focused-tab detection error";
    debug.push({ step: "focused-tab", ok: false, details: { error: message } });
    throw new Error(
      `${message}\n\nDebug trace:\n${toDebugJson({ phase: "resolve-input" }, debug)}`,
    );
  }
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

function maybeResolveCookieBrowser(
  inputResolution: InputResolution,
): string | undefined {
  if (inputResolution.app) return inputResolution.app;

  try {
    return getFocusedTabContext().app;
  } catch {
    return undefined;
  }
}

async function appendResolutionErrorEntry(
  inputResolution: InputResolution,
  language: string,
  errorMessage: string,
): Promise<HistoryEntry> {
  const id = `${Date.now()}-input-error`;
  const entry: HistoryEntry = {
    id,
    fetchKey: `${id}::error`,
    createdAt: new Date().toISOString(),
    videoId: `input-error-${id}`,
    url: inputResolution.url,
    title:
      inputResolution.tabTitle || inputResolution.url || "Unsupported input",
    language: normalizeLanguage(language) || undefined,
    format: "text",
    segmentCount: 0,
    output: "Failed to fetch transcript.",
    status: "error",
    errorLog: errorMessage,
    debugLog: toDebugJson(
      {
        phase: "extract-video-id",
        source: inputResolution.source,
        app: inputResolution.app,
        resolvedUrl: inputResolution.url,
        requestedLanguage: normalizeLanguage(language) || "auto",
        format: "text",
        error: errorMessage,
      },
      [
        ...inputResolution.debug,
        { step: "history-write-input-error", ok: true },
      ],
    ),
  };

  await prependHistory(entry);
  return entry;
}

async function queueTranscriptJob(
  videoInput: string,
  language: string,
): Promise<{ entry: HistoryEntry; fromCache: boolean }> {
  const inputResolution = await resolveYoutubeInput(videoInput);
  const resolvedUrl = inputResolution.url;
  const normalizedLanguage = normalizeLanguage(language);

  let videoId: string;
  try {
    videoId = extractVideoId(resolvedUrl);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Please provide a valid YouTube URL or video ID.";

    if (inputResolution.source === "focused-tab") {
      await appendResolutionErrorEntry(
        inputResolution,
        normalizedLanguage,
        message,
      );
    }

    throw new Error(
      `${message}\n\nDebug trace:\n${toDebugJson({ phase: "extract-video-id", resolvedUrl }, inputResolution.debug)}`,
    );
  }

  const fetchKey = makeFetchKey(videoId, normalizedLanguage);
  const history = await loadHistory();
  const { reusable, inFlight, retryable } = findReusableEntry(
    history,
    fetchKey,
  );

  if (reusable) {
    return {
      entry: {
        ...reusable,
        format: "text",
        output: materializeOutput(reusable, "text"),
      },
      fromCache: true,
    };
  }

  if (inFlight) {
    return {
      entry: {
        ...inFlight,
        format: "text",
      },
      fromCache: true,
    };
  }

  const id = retryable?.id ?? `${Date.now()}-${videoId}`;
  const pending: HistoryEntry = {
    ...(retryable ?? {}),
    id,
    fetchKey,
    createdAt: new Date().toISOString(),
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: retryable?.title || videoId,
    language: normalizedLanguage || undefined,
    format: "text",
    segmentCount: 0,
    output: "Still fetching transcript...",
    rawSegments: undefined,
    status: "fetching",
    errorLog: undefined,
    debugLog: toDebugJson(
      {
        phase: "pending",
        source: inputResolution.source,
        app: inputResolution.app,
        resolvedUrl,
        videoId,
        fetchKey,
        requestedLanguage: normalizedLanguage || "auto",
        format: "text",
      },
      [...inputResolution.debug, { step: "history-write-pending", ok: true }],
    ),
    provider: undefined,
    diagnostics: undefined,
  };

  if (retryable) {
    await patchHistoryEntryAndMoveToFront(id, pending);
  } else {
    await prependHistory(pending);
  }

  const title = await fetchVideoTitle(videoId);
  await patchHistoryEntry(id, { title });

  const ytDlpLocation = findYtDlp();
  const cookieBrowserApp = maybeResolveCookieBrowser(inputResolution);

  try {
    if (!ytDlpLocation) {
      throw new Error(buildMissingYtDlpMessage());
    }

    const result = await fetchTranscriptWithYtDlp({
      videoUrl: resolvedUrl,
      requestedLanguage: normalizedLanguage,
      browserApp: cookieBrowserApp,
      ytDlpPath: ytDlpLocation.path,
    });

    const finished: HistoryEntry = {
      ...pending,
      title,
      output: result.textOutput,
      rawSegments: result.rawSegments,
      language: result.effectiveLanguage,
      segmentCount: result.segmentCount,
      status: "finished",
      provider: result.provider,
      diagnostics: {
        ...result.diagnostics,
        ytDlpSource: ytDlpLocation.source,
      },
      errorLog: undefined,
      debugLog: toDebugJson(
        {
          phase: "transcript-fetched",
          source: inputResolution.source,
          app: inputResolution.app,
          resolvedUrl,
          videoId,
          fetchKey,
          requestedLanguage: normalizedLanguage || "auto",
          effectiveLanguage: result.effectiveLanguage,
          segmentCount: result.segmentCount,
          provider: result.provider,
          diagnostics: {
            ...result.diagnostics,
            ytDlpSource: ytDlpLocation.source,
          },
        },
        [
          ...inputResolution.debug,
          {
            step: "transcript-fetch",
            ok: true,
            details: { segmentCount: result.segmentCount },
          },
        ],
      ),
    };

    await patchHistoryEntry(id, finished);
    return { entry: finished, fromCache: false };
  } catch (error) {
    const friendlyError = toTranscriptError(error);
    const failed: HistoryEntry = {
      ...pending,
      title,
      status: "error",
      output: "Failed to fetch transcript.",
      errorLog: friendlyError.message,
      provider: "yt-dlp",
      diagnostics: {
        ytDlpPath: ytDlpLocation?.path,
        ytDlpSource: ytDlpLocation?.source,
        browserApp: cookieBrowserApp,
        requestedLanguage: normalizedLanguage || "auto",
      },
      debugLog: toDebugJson(
        {
          phase: "transcript-error",
          source: inputResolution.source,
          app: inputResolution.app,
          resolvedUrl,
          videoId,
          fetchKey,
          requestedLanguage: normalizedLanguage || "auto",
          provider: "yt-dlp",
          ytDlpPath: ytDlpLocation?.path,
          ytDlpSource: ytDlpLocation?.source,
          cookieBrowserApp,
          error: error instanceof Error ? error.message : String(error),
          friendlyError: friendlyError.message,
        },
        [
          ...inputResolution.debug,
          {
            step: "transcript-fetch",
            ok: false,
            details: { error: friendlyError.message },
          },
        ],
      ),
    };

    await patchHistoryEntry(id, failed);
    throw friendlyError;
  }
}

async function openHistory() {
  await launchCommand({
    ownerOrAuthorName: "caasols",
    extensionName: "youtube-scribe",
    name: "transcript-history",
    type: LaunchType.UserInitiated,
  });
}

function TranscriptSearchView({ entry }: { entry: HistoryEntry }) {
  const [query, setQuery] = useState("");

  const segments = entry.rawSegments ?? [];
  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return segments.slice(0, 200);
    }

    return segments.filter((segment) =>
      segment.text.toLowerCase().includes(normalizedQuery),
    );
  }, [query, segments]);

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Output"
            content={materializeOutput(entry, entry.format)}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="query"
        title="Search Transcript"
        placeholder="Type to filter transcript segments"
        value={query}
        onChange={setQuery}
      />
      <Form.Description
        text={matches
          .map(
            (segment) =>
              `${Math.round(segment.start_ms / 1000)}s  ${segment.text}`,
          )
          .join("\n\n")}
      />
    </Form>
  );
}

function TranscriptDetailView({
  entry,
  mode,
  onOpenHistory,
  onSetMode,
}: {
  entry: HistoryEntry;
  mode: "text" | "json";
  onOpenHistory: () => Promise<void>;
  onSetMode: (mode: "text" | "json") => Promise<void>;
}) {
  return (
    <Detail
      markdown={buildHistoryDetailMarkdown(entry, mode)}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Output"
            content={materializeOutput(entry, mode)}
          />
          <Action
            title="View as Text"
            icon={Icon.AlignLeft}
            onAction={() => onSetMode("text")}
            shortcut={{ modifiers: ["cmd"], key: "1" }}
          />
          <Action
            title="View as JSON"
            icon={Icon.Code}
            onAction={() => onSetMode("json")}
            shortcut={{ modifiers: ["cmd"], key: "2" }}
          />
          <Action.Push
            title="Search in Transcript"
            icon={Icon.MagnifyingGlass}
            target={<TranscriptSearchView entry={entry} />}
          />
          <Action
            title="View Transcript History"
            icon={Icon.Clock}
            onAction={onOpenHistory}
          />
          <Action.OpenInBrowser title="Open Video" url={entry.url} />
          <Action.CopyToClipboard
            title="Copy Debug Log"
            content={entry.debugLog ?? "No debug data"}
          />
        </ActionPanel>
      }
    />
  );
}

export default function Command(props: LaunchProps<{ arguments: Arguments }>) {
  const [isLoading, setIsLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [uiMode, setUiMode] = useState<UiMode>("bootstrapping");
  const [detailEntry, setDetailEntry] = useState<HistoryEntry | undefined>();
  const [detailMode, setDetailMode] = useState<"text" | "json">("text");

  const defaults = useMemo(
    () => ({
      videoInput: "",
      language: normalizeLanguage(props.arguments.language),
    }),
    [props.arguments.language],
  );

  const { handleSubmit, itemProps } = useForm<FormValues>({
    initialValues: defaults,
    onSubmit: async (values) => {
      setIsLoading(true);
      try {
        const { entry, fromCache } = await queueTranscriptJob(
          values.videoInput,
          values.language,
        );

        if (shouldCopyEntryOutput(entry)) {
          await Clipboard.copy(entry.output);
        }

        if (fromCache) {
          if (getFetchCompletionDestination(entry) === "detail") {
            const preferences = await loadViewModePreferences();
            setDetailMode(
              resolveViewModePreference(preferences, entry.fetchKey),
            );
            setDetailEntry(entry);
            setUiMode("detail");
          } else {
            await openHistory();
          }

          await showToast({
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
                ? "Opened transcript details"
                : "Opened transcript history",
          });
          return;
        }

        setDetailEntry(entry);
        setDetailMode("text");
        setUiMode("detail");
        await showToast({
          style: Toast.Style.Success,
          title: "Transcript ready",
          message: `Opened transcript details • ${entry.segmentCount} segments • ${entry.language ?? "auto"}`,
        });
        return;
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch transcript",
          message: error instanceof Error ? error.message : "Unknown error",
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

      const retryPayloadRaw = await LocalStorage.getItem<string>(
        TRANSCRIPT_RETRY_PAYLOAD_KEY,
      );
      let retryPayload: TranscriptRetryPayload | undefined;
      if (retryPayloadRaw) {
        try {
          retryPayload = JSON.parse(retryPayloadRaw) as TranscriptRetryPayload;
        } catch {
          retryPayload = undefined;
        }
      }
      if (retryPayloadRaw) {
        await LocalStorage.removeItem(TRANSCRIPT_RETRY_PAYLOAD_KEY);
      }

      const clipboardText = await Clipboard.readText();
      const hasAutoUrl = Boolean(
        extractYoutubeUrlFromText(clipboardText ?? undefined),
      );

      let hasFocusedTab = false;
      if (!hasAutoUrl) {
        try {
          hasFocusedTab = Boolean(getFocusedTabContext().url);
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

      setUiMode("auto-running");
      setIsLoading(true);
      try {
        const { entry, fromCache } = await queueTranscriptJob(
          retryPayload?.url ?? defaults.videoInput,
          retryPayload?.language ?? defaults.language,
        );

        if (shouldCopyEntryOutput(entry)) {
          await Clipboard.copy(entry.output);
        }

        if (fromCache) {
          if (getFetchCompletionDestination(entry) === "detail") {
            const preferences = await loadViewModePreferences();
            setDetailMode(
              resolveViewModePreference(preferences, entry.fetchKey),
            );
            setDetailEntry(entry);
            setUiMode("detail");
          } else {
            await openHistory();
          }

          await showToast({
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
                ? "Opened transcript details"
                : "Opened transcript history",
          });
          return;
        }

        setDetailEntry(entry);
        setDetailMode("text");
        setUiMode("detail");
        await showToast({
          style: Toast.Style.Success,
          title: "Transcript ready",
          message: `Opening transcript details • ${entry.segmentCount} segments • ${entry.language ?? "auto"}`,
        });
        return;
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch transcript",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
      }
    }

    maybeRunFromArgs();
  }, [bootstrapped, defaults.language, defaults.videoInput]);

  if (uiMode !== "manual-form") {
    if (uiMode === "detail" && detailEntry) {
      return (
        <TranscriptDetailView
          entry={detailEntry}
          mode={detailMode}
          onOpenHistory={openHistory}
          onSetMode={async (mode) => {
            setDetailMode(mode);
            await saveViewModePreference(detailEntry.fetchKey, mode);
          }}
        />
      );
    }

    const loadingState = getLoadingStateText(
      uiMode === "auto-running" ? "auto-running" : "bootstrapping",
    );

    return (
      <Detail
        isLoading={true}
        markdown={`# ${loadingState.title}\n\n${loadingState.description}`}
      />
    );
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
