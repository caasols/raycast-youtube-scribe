import {
  AI,
  LaunchProps,
  LaunchType,
  Toast,
  launchCommand,
} from "@raycast/api";
import { loadFreshEntry, saveSummary } from "./lib/ai-cache";
import { patchHistoryEntry } from "./history-store";
import { buildTranscriptSummaryPrompt } from "./commands/transcript-history/transcript-ai";
import { getAiModel, getSummarizePromptTemplate } from "./lib/preferences";
import { safeShowToast } from "./lib/safe-toast";

type AiSummarizeTask = {
  entryId: string;
  title: string;
};

type WorkerLaunchContext = {
  task?: AiSummarizeTask;
};

const WORKER_GRACE_PERIOD_MS = 15_000;

export default async function Command(
  props: LaunchProps<{ launchContext: WorkerLaunchContext }>,
) {
  const task = props.launchContext?.task;
  if (!task) return;

  // Grace period: give the foreground summary view time to complete.
  // If the user stays in Raycast, the foreground handles everything.
  // If the user leaves, the foreground is killed and this worker takes over.
  await new Promise((resolve) => setTimeout(resolve, WORKER_GRACE_PERIOD_MS));

  const entry = await loadFreshEntry(task.entryId);
  if (!entry || entry.aiSummarizationStatus !== "generating") return;

  try {
    const prompt = buildTranscriptSummaryPrompt(
      entry,
      getSummarizePromptTemplate(),
    );
    const modelValue = getAiModel();
    const content = await AI.ask(prompt, {
      creativity: "low",
      ...(modelValue ? { model: modelValue as unknown as AI.Model } : {}),
    });

    await saveSummary(task.entryId, entry.aiSummaries, content, "append");
    await patchHistoryEntry(task.entryId, {
      aiSummarizationStatus: undefined,
    });

    await safeShowToast({
      style: Toast.Style.Success,
      title: "Summary ready",
      message: task.title,
      primaryAction: {
        title: "View Summary",
        onAction: () => {
          launchCommand({
            name: "transcript-history",
            type: LaunchType.UserInitiated,
            context: { entryId: task.entryId, navigateTo: "summary" },
          });
        },
      },
      secondaryAction: {
        title: "View AI Chats",
        onAction: () => {
          launchCommand({
            name: "transcript-history",
            type: LaunchType.UserInitiated,
            context: { entryId: task.entryId, navigateTo: "ai-chats" },
          });
        },
      },
    });
  } catch (error) {
    await patchHistoryEntry(task.entryId, {
      aiSummarizationStatus: undefined,
    });
    await safeShowToast({
      style: Toast.Style.Failure,
      title: "Summary failed",
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
