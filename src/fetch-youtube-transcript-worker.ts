import {
  LaunchProps,
  LaunchType,
  Toast,
  launchCommand,
} from "@raycast/api";
// Toast imported for Toast.Style enum used by safeShowToast options
import { loadHistory, patchHistoryEntry } from "./history-store";
import {
  PreparedTranscriptBackgroundTask,
  runPreparedTranscriptJob,
} from "./commands/get-youtube-transcript/transcript-job";
import { fetchTranscriptWithYtDlp, findYtDlp } from "./lib/ytdlp";
import { safeShowToast } from "./lib/safe-toast";
import { getAutoSummarize } from "./lib/preferences";

type WorkerLaunchContext = {
  task?: PreparedTranscriptBackgroundTask;
};

const WORKER_GRACE_PERIOD_MS = 5_000;

export default async function Command(
  props: LaunchProps<{ launchContext: WorkerLaunchContext }>,
) {
  const task = props.launchContext?.task;
  if (!task) {
    return;
  }

  // Grace period: give the foreground command time to complete the fetch.
  // If the user stays in Raycast, the foreground handles everything.
  // If the user leaves, the foreground is killed and this worker takes over.
  await new Promise((resolve) => setTimeout(resolve, WORKER_GRACE_PERIOD_MS));

  const entries = await loadHistory();
  const existing = entries.find((entry) => entry.id === task.entryId);
  if (!existing || existing.status !== "fetching") {
    return;
  }

  try {
    const entry = await runPreparedTranscriptJob(task, {
      findYtDlp,
      fetchTranscriptWithYtDlp,
      patchHistoryEntry,
    });

    await patchHistoryEntry(task.entryId, {
      backgroundCompletedAt: new Date().toISOString(),
    });

    // Auto-summarize if preference is enabled
    if (getAutoSummarize() && !entry.aiSummaries?.length) {
      await patchHistoryEntry(task.entryId, { aiSummarizationStatus: "generating" });
      void launchCommand({
        ownerOrAuthorName: "caasols",
        extensionName: "youtube-transcribe",
        name: "ai-summarize-worker",
        type: LaunchType.Background,
        context: { task: { entryId: task.entryId, title: entry.title } },
      }).catch(() => {});
    }

    await safeShowToast({
      style: Toast.Style.Success,
      title: "Transcript ready",
      message: entry.title,
      primaryAction: {
        title: "View Transcript",
        onAction: () => {
          launchCommand({
            name: "transcript-history",
            type: LaunchType.UserInitiated,
            context: { entryId: task.entryId },
          });
        },
      },
    });
  } catch (error) {
    await safeShowToast({
      style: Toast.Style.Failure,
      title: "Failed to fetch transcript",
      message: error instanceof Error ? error.message : "Unknown error.",
      primaryAction: {
        title: "View in History",
        onAction: () => {
          launchCommand({
            name: "transcript-history",
            type: LaunchType.UserInitiated,
          });
        },
      },
    });
  }
}
