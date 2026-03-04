import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  Icon,
  LaunchProps,
  Toast,
  closeMainWindow,
  popToRoot,
  showToast,
} from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";
import { execFileSync } from "child_process";
import { useEffect, useMemo, useState } from "react";
import { YoutubeTranscript } from "youtube-transcript";
import { prependHistory } from "./history-store";
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

  if (code === "YoutubeTranscriptDisabledError") {
    return new Error("This video has transcripts disabled by the uploader.");
  }

  if (code === "YoutubeTranscriptVideoUnavailableError") {
    return new Error("This video is unavailable (private, removed, or restricted).");
  }

  if (code === "YoutubeTranscriptNotAvailableLanguageError") {
    return new Error(
      preferredLang
        ? `No transcript is available for language '${preferredLang}'. Try leaving language blank to auto-detect.`
        : "No transcript is available for the requested language.",
    );
  }

  if (code === "YoutubeTranscriptNotAvailableError") {
    return new Error("No transcript track is available for this video.");
  }

  if (code === "YoutubeTranscriptTooManyRequestError") {
    return new Error("YouTube is rate-limiting transcript requests right now. Please try again in a moment.");
  }

  return new Error(error.message || "Failed to fetch transcript.");
}

async function buildHistoryEntry(videoInput: string, language: string, format: OutputFormat): Promise<HistoryEntry> {
  const manualUrl = normalizeInput(videoInput);
  const preferredLang = normalizeInput(language);

  const resolvedUrl = manualUrl || getFocusedYoutubeUrl().url;
  const videoId = extractVideoId(resolvedUrl);

  let chunks;
  try {
    // Some videos return no rows when a requested language is unavailable.
    // If that happens, retry without language pinning before failing.
    chunks = await YoutubeTranscript.fetchTranscript(videoId, preferredLang ? { lang: preferredLang } : undefined);

    if (chunks.length === 0 && preferredLang) {
      chunks = await YoutubeTranscript.fetchTranscript(videoId);
    }
  } catch (error) {
    throw toTranscriptError(error, preferredLang);
  }

  const textOutput = chunks
    .map((chunk) => chunk.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!textOutput) {
    throw new Error(
      preferredLang
        ? `Transcript was empty for language '${preferredLang}'. Try leaving language blank to auto-detect.`
        : "Transcript was empty for this video. It may have no accessible transcript track.",
    );
  }

  const output =
    format === "json"
      ? JSON.stringify(
          chunks.map((chunk) => ({ text: chunk.text, start_ms: chunk.offset, duration_ms: chunk.duration })),
          null,
          2,
        )
      : textOutput;

  return {
    id: `${Date.now()}-${videoId}`,
    createdAt: new Date().toISOString(),
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    language: preferredLang || chunks[0]?.lang,
    format,
    segmentCount: chunks.length,
    output,
  };
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
        const entry = await buildHistoryEntry(values.videoInput, values.language, values.format);
        await prependHistory(entry);
        await Clipboard.copy(entry.output);

        await showToast({
          style: Toast.Style.Success,
          title: "Transcript ready",
          message: `Copied to clipboard • ${entry.segmentCount} segments`,
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

      const hasAnyArgs = Boolean(defaults.videoInput || defaults.language || props.arguments.format);
      if (!hasAnyArgs) return;

      setIsLoading(true);
      try {
        const entry = await buildHistoryEntry(defaults.videoInput, defaults.language, defaults.format);
        await prependHistory(entry);
        await Clipboard.copy(entry.output);
        await closeMainWindow();
        await showToast({
          style: Toast.Style.Success,
          title: "Transcript ready",
          message: `Copied to clipboard • ${entry.segmentCount} segments`,
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
      <Form.Description text="Leave URL empty to use the focused YouTube tab in your browser." />
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
