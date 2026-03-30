import {
  LaunchProps,
  LaunchType,
  Toast,
  launchCommand,
} from "@raycast/api";
import { loadHistory, patchHistoryEntry } from "./history-store";
import { runPreparedTranscriptJob } from "./commands/get-youtube-transcript/transcript-job";
import { fetchTranscriptWithYtDlp, findYtDlp } from "./lib/ytdlp";
import { getAutoSummarize } from "./lib/preferences";
import { safeShowToast } from "./lib/safe-toast";
import type { PlaylistBackgroundTask } from "./commands/get-youtube-transcript/playlist-job";

type WorkerLaunchContext = {
  task?: PlaylistBackgroundTask;
};

export default async function Command(
  props: LaunchProps<{ launchContext: WorkerLaunchContext }>,
) {
  const task = props.launchContext?.task;
  if (!task || !task.videoTasks.length) return;

  const total = task.videoTasks.length;
  let completedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < task.videoTasks.length; i++) {
    const videoTask = task.videoTasks[i];

    // Check if entry is still pending (user may have removed it)
    const entries = await loadHistory();
    const existing = entries.find((e) => e.id === videoTask.entryId);
    if (!existing || existing.status !== "fetching") continue;

    // Update status message with progress
    await patchHistoryEntry(videoTask.entryId, {
      statusMessage: `Fetching transcript (${i + 1}/${total})...`,
    });

    try {
      const entry = await runPreparedTranscriptJob(videoTask, {
        findYtDlp,
        fetchTranscriptWithYtDlp,
        patchHistoryEntry,
      });

      await patchHistoryEntry(videoTask.entryId, {
        backgroundCompletedAt: new Date().toISOString(),
      });

      completedCount++;

      // Auto-summarize if enabled
      if (getAutoSummarize() && !entry.aiSummaries?.length) {
        await patchHistoryEntry(videoTask.entryId, {
          aiSummarizationStatus: "generating",
        });
        void launchCommand({
          ownerOrAuthorName: "caasols",
          extensionName: "youtube-transcribe",
          name: "ai-summarize-worker",
          type: LaunchType.Background,
          context: {
            task: { entryId: videoTask.entryId, title: entry.title },
          },
        }).catch(() => {});
      }
    } catch {
      errorCount++;
      // Error already persisted by runPreparedTranscriptJob — continue to next
    }
  }

  const message =
    errorCount > 0
      ? `${completedCount} completed, ${errorCount} failed`
      : `${completedCount} videos processed`;

  await safeShowToast({
    style: errorCount > 0 ? Toast.Style.Failure : Toast.Style.Success,
    title: "Playlist complete",
    message: `${task.playlistTitle} — ${message}`,
    primaryAction: {
      title: "View History",
      onAction: () => {
        launchCommand({
          name: "transcript-history",
          type: LaunchType.UserInitiated,
        });
      },
    },
  });
}
