import { findReusableEntry } from "../../lib/history-logic";
import {
  detectYoutubeContentKind,
  makeFetchKey,
  normalizeLanguage,
} from "../../lib/youtube";
import { fetchPlaylistInfo, PlaylistInfo } from "../../lib/ytdlp";
import type { HistoryEntry } from "../../types";
import type {
  PreparedTranscriptBackgroundTask,
  TranscriptJobDeps,
} from "./transcript-job";

export type PlaylistBackgroundTask = {
  playlistId: string;
  playlistTitle: string;
  videoTasks: PreparedTranscriptBackgroundTask[];
};

export type PlaylistJobResult = {
  playlistInfo: PlaylistInfo;
  entries: HistoryEntry[];
  skippedCount: number;
  backgroundTask: PlaylistBackgroundTask;
};

export async function preparePlaylistJob(
  playlistUrl: string,
  language: string,
  deps: TranscriptJobDeps,
): Promise<PlaylistJobResult> {
  const ytDlpLocation = deps.findYtDlp();
  if (!ytDlpLocation) {
    throw new Error(
      "yt-dlp is not installed. Install it with `brew install yt-dlp` or `pipx install yt-dlp`, then try again.",
    );
  }

  let cookieBrowserApp: string | undefined;
  try {
    cookieBrowserApp = deps.getFocusedTabContext().app;
  } catch {
    // No browser context available
  }

  const playlistInfo = await fetchPlaylistInfo({
    playlistUrl,
    ytDlpPath: ytDlpLocation.path,
    browserApp: cookieBrowserApp,
  });

  const normalizedLanguage = normalizeLanguage(language);
  const history = await deps.loadHistory();
  const entries: HistoryEntry[] = [];
  const videoTasks: PreparedTranscriptBackgroundTask[] = [];
  let skippedCount = 0;

  for (const video of playlistInfo.entries) {
    const fetchKey = makeFetchKey(video.videoId, normalizedLanguage);
    const { reusable, inFlight } = findReusableEntry(history, fetchKey);

    if (reusable || inFlight) {
      skippedCount++;
      continue;
    }

    const id = `${Date.now()}-${video.videoId}`;
    const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    const contentKind = detectYoutubeContentKind(videoUrl) ?? "video";

    const entry: HistoryEntry = {
      id,
      fetchKey,
      createdAt: new Date().toISOString(),
      videoId: video.videoId,
      url: videoUrl,
      contentKind,
      title: video.title,
      language: normalizedLanguage || undefined,
      segmentCount: 0,
      status: "fetching",
      statusMessage: "Queued",
      playlistId: playlistInfo.playlistId,
      playlistTitle: playlistInfo.playlistTitle,
    };

    await deps.prependHistory(entry);
    entries.push(entry);

    videoTasks.push({
      entryId: id,
      fetchKey,
      resolvedUrl: videoUrl,
      videoId: video.videoId,
      contentKind,
      title: video.title,
      requestedLanguage: normalizedLanguage,
      source: "manual",
      debug: [],
      cookieBrowserApp,
    });

    // Small delay between prepends to ensure unique timestamps for ordering
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  return {
    playlistInfo,
    entries,
    skippedCount,
    backgroundTask: {
      playlistId: playlistInfo.playlistId,
      playlistTitle: playlistInfo.playlistTitle,
      videoTasks,
    },
  };
}
