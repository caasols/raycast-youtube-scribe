import { execFileSync } from "node:child_process";
import { normalizeYoutubeVideoUrl } from "./youtube";

export const BROWSER_SCRIPTS: Record<string, string> = {
  "Google Chrome":
    'tell application "Google Chrome" to return URL of active tab of front window',
  "Google Chrome Canary":
    'tell application "Google Chrome Canary" to return URL of active tab of front window',
  Chromium:
    'tell application "Chromium" to return URL of active tab of front window',
  "Brave Browser":
    'tell application "Brave Browser" to return URL of active tab of front window',
  "Microsoft Edge":
    'tell application "Microsoft Edge" to return URL of active tab of front window',
  Safari:
    'tell application "Safari" to return URL of current tab of front window',
  "Safari Technology Preview":
    'tell application "Safari Technology Preview" to return URL of current tab of front window',
  Arc: 'tell application "Arc" to return URL of active tab of front window',
  Vivaldi:
    'tell application "Vivaldi" to return URL of active tab of front window',
  Opera: 'tell application "Opera" to return URL of active tab of front window',
};

export const BROWSER_COOKIE_MAP: Record<string, string> = {
  "Google Chrome": "chrome",
  "Google Chrome Canary": "chrome",
  Chromium: "chromium",
  "Brave Browser": "brave",
  "Microsoft Edge": "edge",
  Safari: "safari",
  "Safari Technology Preview": "safari",
  Arc: "chrome",
  Vivaldi: "vivaldi",
  Opera: "opera",
};

export function runAppleScript(script: string): string | null {
  try {
    return (
      execFileSync("osascript", ["-e", script], { encoding: "utf-8" }).trim() ||
      null
    );
  } catch {
    return null;
  }
}

export function getFocusedTabContext(): {
  url: string;
  title: string;
  app: string;
} {
  if (process.platform !== "darwin") {
    throw new Error(
      "Focused browser detection is only available on macOS. Paste the YouTube URL instead.",
    );
  }

  const app = runAppleScript(
    'tell application "System Events" to return name of first application process whose frontmost is true',
  );

  if (!app)
    throw new Error(
      "Could not detect the frontmost application. Paste a YouTube URL instead.",
    );
  if (app === "Firefox")
    throw new Error("Firefox detected. Please paste the YouTube URL manually.");

  const browserScript = BROWSER_SCRIPTS[app];
  if (!browserScript)
    throw new Error(
      `'${app}' is not a supported browser. Paste a YouTube URL instead.`,
    );

  const url = runAppleScript(browserScript);
  if (!url)
    throw new Error(`Could not retrieve the current tab URL from ${app}.`);

  const titleScript = browserScript.replace("URL", "title");
  const title = runAppleScript(titleScript) ?? "Untitled tab";

  return { url, title, app };
}

export function getFocusedYoutubeUrl(): {
  url: string;
  app: string;
  title: string;
} {
  const focused = getFocusedTabContext();
  const normalizedUrl = normalizeYoutubeVideoUrl(focused.url);

  if (!normalizedUrl) {
    throw new Error(
      `Focused tab in ${focused.app} is not a supported YouTube video page. Paste a YouTube watch URL, youtu.be link, shorts link, or video ID instead.`,
    );
  }

  return { ...focused, url: normalizedUrl };
}
