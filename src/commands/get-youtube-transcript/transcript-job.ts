import { findReusableEntry } from "../../lib/history-logic";
import { classifyContentKind } from "../../lib/content-classification";
import {
  detectYoutubeContentKind,
  extractVideoId,
  extractYoutubeUrlFromText,
  makeFetchKey,
  normalizeInput,
  normalizeLanguage,
} from "../../lib/youtube";
import {
  classifyTranscriptError,
  formatTranscriptError,
} from "../../lib/error-classification";
import type {
  HistoryEntry,
  TranscriptErrorKind,
  TranscriptResult,
} from "../../types";

export type DebugStep = {
  step: string;
  ok: boolean;
  details?: Record<string, unknown>;
};

export type InputResolution = {
  url: string;
  source: "manual" | "clipboard" | "focused-tab";
  app?: string;
  tabTitle?: string;
  debug: DebugStep[];
};

export type TranscriptJobDeps = {
  readClipboardText: () => Promise<string | undefined>;
  getFocusedYoutubeUrl: () => { url: string; app: string; title: string };
  getFocusedTabContext: () => { url: string; app: string; title: string };
  loadHistory: () => Promise<HistoryEntry[]>;
  prependHistory: (entry: HistoryEntry) => Promise<HistoryEntry[]>;
  patchHistoryEntry: (
    id: string,
    patch: Partial<HistoryEntry>,
  ) => Promise<HistoryEntry[]>;
  patchHistoryEntryAndMoveToFront: (
    id: string,
    patch: Partial<HistoryEntry>,
  ) => Promise<HistoryEntry[]>;
  fetchVideoTitle: (videoId: string) => Promise<string>;
  findYtDlp: () => { path: string; source: "candidate" | "which" } | null;
  fetchTranscriptWithYtDlp: (options: {
    videoUrl: string;
    requestedLanguage?: string;
    browserApp?: string;
    ytDlpPath: string;
  }) => Promise<TranscriptResult>;
};

export type PreparedTranscriptBackgroundTask = {
  entryId: string;
  fetchKey: string;
  resolvedUrl: string;
  videoId: string;
  contentKind: "video" | "short";
  title: string;
  requestedLanguage: string;
  source: InputResolution["source"];
  app?: string;
  debug: DebugStep[];
  cookieBrowserApp?: string;
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

export function buildMissingYtDlpMessage(): string {
  return [
    "yt-dlp is not installed.",
    "Install it with `brew install yt-dlp` or `pipx install yt-dlp`, then try again.",
  ].join(" ");
}

export function toTranscriptError(error: unknown): {
  error: Error;
  kind: TranscriptErrorKind;
} {
  const raw = error instanceof Error ? error.message.trim() : "";
  const kind = classifyTranscriptError(raw);
  const message = kind === "unknown" && raw ? raw : formatTranscriptError(kind);
  return { error: new Error(message), kind };
}

export async function resolveYoutubeInput(
  videoInput: string,
  deps: Pick<TranscriptJobDeps, "readClipboardText" | "getFocusedYoutubeUrl">,
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

  const clipboardText = await deps.readClipboardText();
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
    const focused = deps.getFocusedYoutubeUrl();
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

function maybeResolveCookieBrowser(
  inputResolution: InputResolution,
  deps: Pick<TranscriptJobDeps, "getFocusedTabContext">,
): string | undefined {
  if (inputResolution.app) return inputResolution.app;

  try {
    return deps.getFocusedTabContext().app;
  } catch {
    return undefined;
  }
}

async function appendResolutionErrorEntry(
  inputResolution: InputResolution,
  language: string,
  errorMessage: string,
  deps: Pick<TranscriptJobDeps, "prependHistory">,
): Promise<HistoryEntry> {
  const id = `${Date.now()}-input-error`;
  const entry: HistoryEntry = {
    id,
    fetchKey: `${id}::error`,
    createdAt: new Date().toISOString(),
    videoId: `input-error-${id}`,
    url: inputResolution.url,
    contentKind: detectYoutubeContentKind(inputResolution.url) ?? "video",
    title:
      inputResolution.tabTitle || inputResolution.url || "Unsupported input",
    language: normalizeLanguage(language) || undefined,
    segmentCount: 0,
    status: "error",
    statusMessage: "Failed to fetch transcript.",
    errorLog: errorMessage,
    errorKind: "unknown" as const,
    debugLog: toDebugJson(
      {
        phase: "extract-video-id",
        source: inputResolution.source,
        app: inputResolution.app,
        resolvedUrl: inputResolution.url,
        requestedLanguage: normalizeLanguage(language) || "auto",
        error: errorMessage,
      },
      [
        ...inputResolution.debug,
        { step: "history-write-input-error", ok: true },
      ],
    ),
  };

  await deps.prependHistory(entry);
  return entry;
}

export async function prepareTranscriptJob(
  videoInput: string,
  language: string,
  deps: TranscriptJobDeps,
): Promise<{
  entry: HistoryEntry;
  fromCache: boolean;
  backgroundTask?: PreparedTranscriptBackgroundTask;
}> {
  const inputResolution = await resolveYoutubeInput(videoInput, deps);
  const resolvedUrl = inputResolution.url;
  const normalizedLanguage = normalizeLanguage(language);
  const contentKind = detectYoutubeContentKind(resolvedUrl) ?? "video";

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
        deps,
      );
    }

    throw new Error(
      `${message}\n\nDebug trace:\n${toDebugJson({ phase: "extract-video-id", resolvedUrl }, inputResolution.debug)}`,
    );
  }

  const fetchKey = makeFetchKey(videoId, normalizedLanguage);
  const history = await deps.loadHistory();
  const { reusable, inFlight, retryable } = findReusableEntry(
    history,
    fetchKey,
  );

  if (reusable) {
    return {
      entry: reusable,
      fromCache: true,
      backgroundTask: undefined,
    };
  }

  if (inFlight) {
    return {
      entry: inFlight,
      fromCache: true,
      backgroundTask: undefined,
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
    contentKind,
    title: retryable?.title || videoId,
    language: normalizedLanguage || undefined,
    segmentCount: 0,
    rawSegments: undefined,
    status: "fetching",
    statusMessage: "Fetching transcript",
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
      },
      [...inputResolution.debug, { step: "history-write-pending", ok: true }],
    ),
    provider: undefined,
    diagnostics: undefined,
  };

  if (retryable) {
    await deps.patchHistoryEntryAndMoveToFront(id, pending);
  } else {
    await deps.prependHistory(pending);
  }

  const title = await deps.fetchVideoTitle(videoId);
  await deps.patchHistoryEntry(id, { title });
  const cookieBrowserApp = maybeResolveCookieBrowser(inputResolution, deps);

  return {
    entry: {
      ...pending,
      title,
    },
    fromCache: false,
    backgroundTask: {
      entryId: id,
      fetchKey,
      resolvedUrl,
      videoId,
      contentKind,
      title,
      requestedLanguage: normalizedLanguage,
      source: inputResolution.source,
      app: inputResolution.app,
      debug: inputResolution.debug,
      cookieBrowserApp,
    },
  };
}

const RETRYABLE_ERROR_KINDS: Set<TranscriptErrorKind> = new Set([
  "timeout",
  "rate-limited",
]);
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 4000, 8000];

export async function runPreparedTranscriptJob(
  task: PreparedTranscriptBackgroundTask,
  deps: Pick<
    TranscriptJobDeps,
    "findYtDlp" | "fetchTranscriptWithYtDlp" | "patchHistoryEntry"
  >,
): Promise<HistoryEntry> {
  const ytDlpLocation = deps.findYtDlp();
  const cookieBrowserApp = task.cookieBrowserApp;

  try {
    if (!ytDlpLocation) {
      throw new Error(buildMissingYtDlpMessage());
    }

    let lastError: unknown;
    let result: TranscriptResult | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        result = await deps.fetchTranscriptWithYtDlp({
          videoUrl: task.resolvedUrl,
          requestedLanguage: task.requestedLanguage,
          browserApp: cookieBrowserApp,
          ytDlpPath: ytDlpLocation.path,
        });
        break;
      } catch (err) {
        lastError = err;
        const { kind } = toTranscriptError(err);
        if (!RETRYABLE_ERROR_KINDS.has(kind) || attempt >= MAX_RETRIES) {
          throw err;
        }
        const delayMs = RETRY_DELAYS_MS[attempt] ?? 8000;
        await deps.patchHistoryEntry(task.entryId, {
          statusMessage: `Retrying (attempt ${attempt + 2}/${MAX_RETRIES + 1})...`,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (!result) throw lastError;

    const finished: HistoryEntry = {
      id: task.entryId,
      fetchKey: task.fetchKey,
      createdAt: new Date().toISOString(),
      videoId: task.videoId,
      url: `https://www.youtube.com/watch?v=${task.videoId}`,
      contentKind: classifyContentKind(task.contentKind, result.videoMetadata),
      title: result.videoMetadata?.title ?? task.title,
      rawSegments: result.rawSegments,
      language: result.effectiveLanguage,
      segmentCount: result.segmentCount,
      status: "finished",
      statusMessage: undefined,
      provider: result.provider,
      videoMetadata: result.videoMetadata,
      diagnostics: {
        ...result.diagnostics,
        ytDlpSource: ytDlpLocation.source,
      },
      errorLog: undefined,
      debugLog: toDebugJson(
        {
          phase: "transcript-fetched",
          source: task.source,
          app: task.app,
          resolvedUrl: task.resolvedUrl,
          videoId: task.videoId,
          fetchKey: task.fetchKey,
          requestedLanguage: task.requestedLanguage || "auto",
          effectiveLanguage: result.effectiveLanguage,
          segmentCount: result.segmentCount,
          provider: result.provider,
          diagnostics: {
            ...result.diagnostics,
            ytDlpSource: ytDlpLocation.source,
          },
        },
        [
          ...task.debug,
          {
            step: "transcript-fetch",
            ok: true,
            details: { segmentCount: result.segmentCount },
          },
        ],
      ),
    };

    await deps.patchHistoryEntry(task.entryId, finished);
    return finished;
  } catch (error) {
    const { error: friendlyError, kind: errorKind } = toTranscriptError(error);
    const failed: HistoryEntry = {
      id: task.entryId,
      fetchKey: task.fetchKey,
      createdAt: new Date().toISOString(),
      videoId: task.videoId,
      url: `https://www.youtube.com/watch?v=${task.videoId}`,
      contentKind: task.contentKind,
      title: task.title,
      segmentCount: 0,
      status: "error",
      statusMessage: "Failed to fetch transcript.",
      errorLog: friendlyError.message,
      errorKind,
      provider: "yt-dlp",
      diagnostics: {
        ytDlpPath: ytDlpLocation?.path,
        ytDlpSource: ytDlpLocation?.source,
        browserApp: cookieBrowserApp,
        requestedLanguage: task.requestedLanguage || "auto",
      },
      debugLog: toDebugJson(
        {
          phase: "transcript-error",
          source: task.source,
          app: task.app,
          resolvedUrl: task.resolvedUrl,
          videoId: task.videoId,
          fetchKey: task.fetchKey,
          requestedLanguage: task.requestedLanguage || "auto",
          provider: "yt-dlp",
          ytDlpPath: ytDlpLocation?.path,
          ytDlpSource: ytDlpLocation?.source,
          cookieBrowserApp,
          error: error instanceof Error ? error.message : String(error),
          friendlyError: friendlyError.message,
        },
        [
          ...task.debug,
          {
            step: "transcript-fetch",
            ok: false,
            details: { error: friendlyError.message },
          },
        ],
      ),
    };

    await deps.patchHistoryEntry(task.entryId, failed);
    throw friendlyError;
  }
}
