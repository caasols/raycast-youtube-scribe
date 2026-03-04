import {
  Action,
  ActionPanel,
  Clipboard,
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
import { execFileSync } from "child_process";
import { useEffect, useMemo, useState } from "react";
import { YoutubeTranscript } from "youtube-transcript";
import { loadHistory, patchHistoryEntry, prependHistory } from "./history-store";
import { HistoryEntry, OutputFormat, TranscriptSegment } from "./types";

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

const BUILD_TAG = "diag-2026-03-04d";

const BROWSER_SCRIPTS: Record<string, string> = {
  "Google Chrome": 'tell application "Google Chrome" to return URL of active tab of front window',
  "Google Chrome Canary": 'tell application "Google Chrome Canary" to return URL of active tab of front window',
  Chromium: 'tell application "Chromium" to return URL of active tab of front window',
  "Brave Browser": 'tell application "Brave Browser" to return URL of active tab of front window',
  "Microsoft Edge": 'tell application "Microsoft Edge" to return URL of active tab of front window',
  Safari: 'tell application "Safari" to return URL of current tab of front window',
  "Safari Technology Preview":
    'tell application "Safari Technology Preview" to return URL of current tab of front window',
  Arc: 'tell application "Arc" to return URL of active tab of front window',
  Vivaldi: 'tell application "Vivaldi" to return URL of active tab of front window',
  Opera: 'tell application "Opera" to return URL of active tab of front window',
};

function normalizeInput(input?: string): string {
  return (input ?? "").trim();
}

function toOutputFormat(value?: string): OutputFormat {
  return value?.toLowerCase() === "json" ? "json" : "text";
}

function extractYoutubeUrlFromText(text?: string): string | null {
  const value = normalizeInput(text);
  if (!value) return null;

  const match = value.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s)]+/i);
  return match?.[0] ?? null;
}

function extractVideoId(input: string): string {
  const value = normalizeInput(input);

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value);

    if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "");

    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;

      const shorts = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shorts?.[1]) return shorts[1];
    }
  } catch {
    // ignore parse issues
  }

  throw new Error("Please provide a valid YouTube URL or video ID.");
}

function runAppleScript(script: string): string | null {
  try {
    return execFileSync("osascript", ["-e", script], { encoding: "utf-8" }).trim() || null;
  } catch {
    return null;
  }
}

type DebugStep = {
  step: string;
  ok: boolean;
  details?: Record<string, unknown>;
};

type InputResolution = {
  url: string;
  source: "manual" | "clipboard" | "focused-tab";
  app?: string;
  debug: DebugStep[];
};

function toDebugJson(context: Record<string, unknown>, steps: DebugStep[]): string {
  return JSON.stringify(
    {
      build: BUILD_TAG,
      at: new Date().toISOString(),
      ...context,
      steps,
    },
    null,
    2,
  );
}

function getFocusedYoutubeUrl(): { url: string; app: string } {
  if (process.platform !== "darwin") {
    throw new Error("Focused browser detection is only available on macOS. Paste the YouTube URL instead.");
  }

  const app = runAppleScript(
    'tell application "System Events" to return name of first application process whose frontmost is true',
  );

  if (!app) throw new Error("Could not detect the frontmost application. Paste a YouTube URL instead.");
  if (app === "Firefox") throw new Error("Firefox detected. Please paste the YouTube URL manually.");

  const browserScript = BROWSER_SCRIPTS[app];
  if (!browserScript) throw new Error(`'${app}' is not a supported browser. Paste a YouTube URL instead.`);

  const url = runAppleScript(browserScript);
  if (!url) throw new Error(`Could not retrieve the current tab URL from ${app}.`);
  if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
    throw new Error(`Focused tab in ${app} is not a YouTube page. Paste a YouTube URL or focus a YouTube tab.`);
  }

  return { url, app };
}

function toTranscriptError(error: unknown, preferredLang: string): Error {
  if (!(error instanceof Error)) return new Error("Failed to fetch transcript due to an unknown error.");

  const code = error.name;
  const rawMessage = (error.message || "").trim();
  const msg = rawMessage.toLowerCase();
  const details = rawMessage ? ` [${code}] ${rawMessage}` : ` [${code}]`;

  if (code === "YoutubeTranscriptDisabledError" || msg.includes("transcript is disabled")) {
    return new Error(`This video has transcripts disabled by the uploader.${details}`);
  }

  if (code === "YoutubeTranscriptVideoUnavailableError" || msg.includes("video unavailable")) {
    return new Error(`This video is unavailable (private, removed, or restricted).${details}`);
  }

  if (code === "YoutubeTranscriptNotAvailableLanguageError") {
    return new Error(
      preferredLang
        ? `No transcript is available for language '${preferredLang}'. Try leaving language blank to auto-detect.${details}`
        : `No transcript is available for the requested language.${details}`,
    );
  }

  if (code === "YoutubeTranscriptNotAvailableError" || msg.includes("no transcripts are available")) {
    return new Error(`No transcript track is available for this video.${details}`);
  }

  if (code === "YoutubeTranscriptTooManyRequestError" || msg.includes("too many request")) {
    return new Error(`YouTube is rate-limiting transcript requests right now. Please try again in a moment.${details}`);
  }

  return new Error((error.message || "Failed to fetch transcript.") + details);
}

async function resolveYoutubeInput(videoInput: string): Promise<InputResolution> {
  const debug: DebugStep[] = [];

  const manualUrl = normalizeInput(videoInput);
  if (manualUrl) {
    debug.push({ step: "manual-input", ok: true, details: { value: manualUrl } });
    return { url: manualUrl, source: "manual", debug };
  }
  debug.push({ step: "manual-input", ok: false });

  const clipboardText = await Clipboard.readText();
  const clipboardUrl = extractYoutubeUrlFromText(clipboardText ?? undefined);
  if (clipboardUrl) {
    debug.push({ step: "clipboard-scan", ok: true, details: { value: clipboardUrl } });
    return { url: clipboardUrl, source: "clipboard", debug };
  }
  debug.push({ step: "clipboard-scan", ok: false });

  try {
    const focused = getFocusedYoutubeUrl();
    debug.push({ step: "focused-tab", ok: true, details: { app: focused.app, value: focused.url } });
    return { url: focused.url, source: "focused-tab", app: focused.app, debug };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown focused-tab detection error";
    debug.push({ step: "focused-tab", ok: false, details: { error: message } });
    throw new Error(
      `${message}\n\nDebug trace:\n${toDebugJson({ phase: "resolve-input", source: "none" }, debug)}`,
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

function buildTextOutput(rawSegments: TranscriptSegment[]): string {
  return rawSegments
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildJsonOutput(rawSegments: TranscriptSegment[]): string {
  return JSON.stringify(rawSegments, null, 2);
}

function materializeOutput(entry: HistoryEntry, format: OutputFormat): string {
  if (entry.rawSegments && entry.rawSegments.length > 0) {
    return format === "json" ? buildJsonOutput(entry.rawSegments) : buildTextOutput(entry.rawSegments);
  }

  return entry.output;
}

async function fetchTranscriptOutput(videoId: string, language: string) {
  const preferredLang = normalizeInput(language);

  let chunks;
  try {
    chunks = await YoutubeTranscript.fetchTranscript(videoId, preferredLang ? { lang: preferredLang } : undefined);

    if (chunks.length === 0 && preferredLang) {
      chunks = await YoutubeTranscript.fetchTranscript(videoId);
    }
  } catch (error) {
    throw toTranscriptError(error, preferredLang);
  }

  const rawSegments: TranscriptSegment[] = chunks.map((chunk) => ({
    text: chunk.text,
    start_ms: chunk.offset,
    duration_ms: chunk.duration,
  }));

  const textOutput = buildTextOutput(rawSegments);

  if (!textOutput) {
    throw new Error(
      preferredLang
        ? `Transcript was empty for language '${preferredLang}'. Try leaving language blank to auto-detect.`
        : "Transcript was empty for this video. It may have no accessible transcript track.",
    );
  }

  return {
    rawSegments,
    textOutput,
    jsonOutput: buildJsonOutput(rawSegments),
    language: preferredLang || chunks[0]?.lang,
    segmentCount: chunks.length,
  };
}

async function queueTranscriptJob(
  videoInput: string,
  language: string,
  format: OutputFormat,
): Promise<{ entry: HistoryEntry; fromCache: boolean }> {
  const inputResolution = await resolveYoutubeInput(videoInput);
  const resolvedUrl = inputResolution.url;

  let videoId: string;
  try {
    videoId = extractVideoId(resolvedUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Please provide a valid YouTube URL or video ID.";
    throw new Error(
      `${message}\n\nDebug trace:\n${toDebugJson({ phase: "extract-video-id", resolvedUrl }, inputResolution.debug)}`,
    );
  }

  const history = await loadHistory();
  const existing = history.find((entry) => entry.videoId === videoId && entry.status === "finished");
  if (existing) {
    return {
      entry: {
        ...existing,
        output: materializeOutput(existing, format),
        format,
        debugLog: toDebugJson(
          {
            phase: "cache-hit",
            source: inputResolution.source,
            app: inputResolution.app,
            resolvedUrl,
            videoId,
          },
          [...inputResolution.debug, { step: "cache-hit", ok: true }],
        ),
      },
      fromCache: true,
    };
  }

  const id = `${Date.now()}-${videoId}`;

  const pending: HistoryEntry = {
    id,
    createdAt: new Date().toISOString(),
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: videoId,
    language: normalizeInput(language) || undefined,
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
        requestedLanguage: normalizeInput(language) || "auto",
        format,
      },
      [...inputResolution.debug, { step: "history-write-pending", ok: true }],
    ),
  };

  await prependHistory(pending);

  const title = await fetchVideoTitle(videoId);
  await patchHistoryEntry(id, { title });

  try {
    const result = await fetchTranscriptOutput(videoId, language);
    const finished = {
      ...pending,
      title,
      output: format === "json" ? result.jsonOutput : result.textOutput,
      rawSegments: result.rawSegments,
      language: result.language,
      segmentCount: result.segmentCount,
      status: "finished" as const,
      errorLog: undefined,
      debugLog: toDebugJson(
        {
          phase: "transcript-fetched",
          source: inputResolution.source,
          app: inputResolution.app,
          resolvedUrl,
          videoId,
          requestedLanguage: normalizeInput(language) || "auto",
          effectiveLanguage: result.language ?? "unknown",
          segmentCount: result.segmentCount,
          format,
        },
        [...inputResolution.debug, { step: "transcript-fetch", ok: true, details: { segmentCount: result.segmentCount } }],
      ),
    };
    await patchHistoryEntry(id, finished);
    return { entry: finished, fromCache: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const failed: HistoryEntry = {
      ...pending,
      title,
      status: "error",
      output: `Failed to fetch transcript.`,
      errorLog: errorMessage,
      debugLog: toDebugJson(
        {
          phase: "transcript-error",
          source: inputResolution.source,
          app: inputResolution.app,
          resolvedUrl,
          videoId,
          requestedLanguage: normalizeInput(language) || "auto",
          format,
          error: errorMessage,
        },
        [...inputResolution.debug, { step: "transcript-fetch", ok: false, details: { error: errorMessage } }],
      ),
    };
    await patchHistoryEntry(id, failed);
    throw error;
  }
}

export default function Command(props: LaunchProps<{ arguments: Arguments }>) {
  const [isLoading, setIsLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const defaults = useMemo(
    () => ({
      videoInput: normalizeInput(props.arguments.url),
      language: normalizeInput(props.arguments.language),
      format: toOutputFormat(props.arguments.format),
    }),
    [props.arguments.format, props.arguments.language, props.arguments.url],
  );

  const { handleSubmit, itemProps } = useForm<FormValues>({
    initialValues: defaults,
    onSubmit: async (values) => {
      setIsLoading(true);
      try {
        const { entry, fromCache } = await queueTranscriptJob(values.videoInput, values.language, values.format);
        await Clipboard.copy(entry.output);

        if (fromCache) {
          await launchCommand({
            ownerOrAuthorName: "caasols",
            extensionName: "youtube-scribe",
            name: "transcript-history",
            type: LaunchType.UserInitiated,
            arguments: { videoId: entry.videoId },
          });

          await showToast({
            style: Toast.Style.Success,
            title: "Transcript already cached",
            message: `Opened history for ${entry.videoId}`,
          });
          return;
        }

        await showToast({
          style: Toast.Style.Success,
          title: "Transcript ready",
          message: `Copied to clipboard • ${entry.segmentCount} segments`,
        });

        await popToRoot();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: `Failed to fetch transcript (${BUILD_TAG})`,
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
      const hasAutoUrl = Boolean(extractYoutubeUrlFromText(clipboardText ?? undefined));
      const hasAnyArgs = Boolean(defaults.videoInput || defaults.language || props.arguments.format);

      let hasFocusedYoutube = false;
      if (!hasAnyArgs && !hasAutoUrl) {
        try {
          hasFocusedYoutube = Boolean(getFocusedYoutubeUrl().url);
        } catch {
          hasFocusedYoutube = false;
        }
      }

      if (!hasAnyArgs && !hasAutoUrl && !hasFocusedYoutube) return;

      setIsLoading(true);
      try {
        const { entry, fromCache } = await queueTranscriptJob(defaults.videoInput, defaults.language, defaults.format);
        await Clipboard.copy(entry.output);

        if (fromCache) {
          await launchCommand({
            ownerOrAuthorName: "caasols",
            extensionName: "youtube-scribe",
            name: "transcript-history",
            type: LaunchType.UserInitiated,
            arguments: { videoId: entry.videoId },
          });

          await showToast({
            style: Toast.Style.Success,
            title: "Transcript already cached",
            message: `Opened history for ${entry.videoId}`,
          });
          return;
        }

        await closeMainWindow();
        await showToast({
          style: Toast.Style.Success,
          title: "Transcript ready",
          message: `Copied to clipboard • ${entry.segmentCount} segments`,
        });
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: `Failed to fetch transcript (${BUILD_TAG})`,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
      }
    }

    maybeRunFromArgs();
  }, [bootstrapped, defaults.format, defaults.language, defaults.videoInput, props.arguments.format]);

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Fetch Transcript" icon={Icon.Download} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text={`Leave URL empty to auto-detect from clipboard first, then focused browser tab. (${BUILD_TAG})`} />
      <Form.TextField
        title="YouTube URL or Video ID"
        placeholder="Optional: auto-detect from focused tab if empty"
        {...itemProps.videoInput}
      />
      <Form.TextField title="Language" placeholder="Optional, e.g. en, pt, es" {...itemProps.language} />
      <Form.Dropdown title="Output Format" {...itemProps.format}>
        <Form.Dropdown.Item value="text" title="text" />
        <Form.Dropdown.Item value="json" title="json" />
      </Form.Dropdown>
    </Form>
  );
}
