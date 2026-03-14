import {
  Action,
  ActionPanel,
  Clipboard,
  Detail,
  Form,
  Icon,
  LaunchProps,
  LaunchType,
  Toast,
  closeMainWindow,
  launchCommand,
  popToRoot,
  showToast,
} from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";
import { useEffect, useMemo, useState } from "react";
import {
  loadHistory,
  patchHistoryEntry,
  prependHistory,
} from "./history-store";
import { getFocusedTabContext, getFocusedYoutubeUrl } from "./lib/browser";
import { findReusableEntry, shouldCopyEntryOutput } from "./lib/history-logic";
import { getInitialLaunchMode } from "./lib/launch-mode";
import { getLoadingStateText } from "./lib/loading-state";
import { fetchTranscriptWithYtDlp, findYtDlp } from "./lib/ytdlp";
import { materializeOutput } from "./lib/output";
import {
  extractVideoId,
  extractYoutubeUrlFromText,
  makeFetchKey,
  normalizeInput,
  normalizeLanguage,
} from "./lib/youtube";
import { HistoryEntry, OutputFormat } from "./types";

type Arguments = {
  url?: string;
  language?: string;
  format?: string;
};

type FormValues = {
  videoInput: string;
  language: string;
  format: OutputFormat;
};

type UiMode = "bootstrapping" | "auto-running" | "manual-form";

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

function toOutputFormat(value?: string): OutputFormat {
  return value?.toLowerCase() === "json" ? "json" : "text";
}

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
  format: OutputFormat,
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
    format,
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
        format,
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
  format: OutputFormat,
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
        format,
        message,
      );
    }

    throw new Error(
      `${message}\n\nDebug trace:\n${toDebugJson({ phase: "extract-video-id", resolvedUrl }, inputResolution.debug)}`,
    );
  }

  const fetchKey = makeFetchKey(videoId, normalizedLanguage);
  const history = await loadHistory();
  const { reusable, inFlight } = findReusableEntry(history, fetchKey);

  if (reusable) {
    return {
      entry: {
        ...reusable,
        format,
        output: materializeOutput(reusable, format),
      },
      fromCache: true,
    };
  }

  if (inFlight) {
    return {
      entry: {
        ...inFlight,
        format,
      },
      fromCache: true,
    };
  }

  const id = `${Date.now()}-${videoId}`;
  const pending: HistoryEntry = {
    id,
    fetchKey,
    createdAt: new Date().toISOString(),
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: videoId,
    language: normalizedLanguage || undefined,
    format,
    segmentCount: 0,
    output: "Still fetching transcript...",
    status: "fetching",
    debugLog: toDebugJson(
      {
        phase: "pending",
        source: inputResolution.source,
        app: inputResolution.app,
        resolvedUrl,
        videoId,
        fetchKey,
        requestedLanguage: normalizedLanguage || "auto",
        format,
      },
      [...inputResolution.debug, { step: "history-write-pending", ok: true }],
    ),
  };

  await prependHistory(pending);

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
      output: format === "json" ? result.jsonOutput : result.textOutput,
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

export default function Command(props: LaunchProps<{ arguments: Arguments }>) {
  const [isLoading, setIsLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [uiMode, setUiMode] = useState<UiMode>("bootstrapping");

  const defaults = useMemo(
    () => ({
      videoInput: normalizeInput(props.arguments.url),
      language: normalizeLanguage(props.arguments.language),
      format: toOutputFormat(props.arguments.format),
    }),
    [props.arguments.format, props.arguments.language, props.arguments.url],
  );

  const { handleSubmit, itemProps } = useForm<FormValues>({
    initialValues: defaults,
    onSubmit: async (values) => {
      setIsLoading(true);
      try {
        const { entry, fromCache } = await queueTranscriptJob(
          values.videoInput,
          values.language,
          values.format,
        );

        if (shouldCopyEntryOutput(entry)) {
          await Clipboard.copy(entry.output);
        }

        if (fromCache) {
          await openHistory();

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
            message: "Opened transcript history",
          });
          return;
        }

        await showToast({
          style: Toast.Style.Success,
          title: "Transcript ready",
          message: `Copied to clipboard • ${entry.segmentCount} segments • ${entry.language ?? "auto"}`,
        });

        await popToRoot();
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
      format: FormValidation.Required,
    },
  });

  useEffect(() => {
    async function maybeRunFromArgs() {
      if (bootstrapped) return;
      setBootstrapped(true);

      const clipboardText = await Clipboard.readText();
      const hasAutoUrl = Boolean(
        extractYoutubeUrlFromText(clipboardText ?? undefined),
      );
      const hasUrlArgument = Boolean(defaults.videoInput);
      const hasLanguageArgument = Boolean(defaults.language);
      const hasFormatArgument = Boolean(props.arguments.format);

      let hasFocusedTab = false;
      if (
        !hasUrlArgument &&
        !hasLanguageArgument &&
        !hasFormatArgument &&
        !hasAutoUrl
      ) {
        try {
          hasFocusedTab = Boolean(getFocusedTabContext().url);
        } catch {
          hasFocusedTab = false;
        }
      }

      const launchMode = getInitialLaunchMode({
        hasUrlArgument,
        hasLanguageArgument,
        hasFormatArgument,
        hasClipboardUrl: hasAutoUrl,
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
          defaults.videoInput,
          defaults.language,
          defaults.format,
        );

        if (shouldCopyEntryOutput(entry)) {
          await Clipboard.copy(entry.output);
        }

        if (fromCache) {
          await openHistory();

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
            message: "Opened transcript history",
          });
          return;
        }

        await closeMainWindow();
        await showToast({
          style: Toast.Style.Success,
          title: "Transcript ready",
          message: `Copied to clipboard • ${entry.segmentCount} segments • ${entry.language ?? "auto"}`,
        });
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
  }, [
    bootstrapped,
    defaults.format,
    defaults.language,
    defaults.videoInput,
    props.arguments.format,
  ]);

  if (uiMode !== "manual-form") {
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
      <Form.Description text="Leave the URL empty to auto-detect from the clipboard first, then the focused browser tab. Requires a local `yt-dlp` install." />
      <Form.TextField
        title="YouTube URL or Video ID"
        placeholder="Optional: auto-detect from clipboard or focused tab"
        {...itemProps.videoInput}
      />
      <Form.TextField
        title="Language"
        placeholder="Optional, e.g. en, pt, es"
        {...itemProps.language}
      />
      <Form.Dropdown title="Output Format" {...itemProps.format}>
        <Form.Dropdown.Item value="text" title="text" />
        <Form.Dropdown.Item value="json" title="json" />
      </Form.Dropdown>
    </Form>
  );
}
