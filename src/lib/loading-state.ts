export type LoadingStateMode = "detecting" | "fetching" | "opening";

const loadingSteps: Array<{
  mode: LoadingStateMode;
  label: string;
}> = [
  { mode: "detecting", label: "Detecting video" },
  { mode: "fetching", label: "Fetching transcript" },
  { mode: "opening", label: "Opening transcript" },
];

export function getLoadingStateText(mode: LoadingStateMode): {
  title: string;
  progressLabel: string;
  progressBar: string;
  description: string;
} {
  if (mode === "fetching") {
    return {
      title: "Fetching Transcript",
      progressLabel: "Step 2 of 3",
      progressBar: "█████▒▒▒▒▒░░░░░░",
      description:
        "Fetching captions for the detected video. This may take a few seconds.",
    };
  }

  if (mode === "opening") {
    return {
      title: "Opening Transcript",
      progressLabel: "Step 3 of 3",
      progressBar: "███████████▒▒▒▒▒",
      description: "Transcript ready. Opening the detail view now.",
    };
  }

  return {
    title: "Detecting Video",
    progressLabel: "Step 1 of 3",
    progressBar: "▒▒▒▒░░░░░░░░░░░░",
    description: "Checking clipboard and browser tab for a YouTube video.",
  };
}

export function getLoadingStateMarkdown(mode: LoadingStateMode): string {
  const state = getLoadingStateText(mode);
  const currentIndex = loadingSteps.findIndex((step) => step.mode === mode);
  const stepList = loadingSteps
    .map((step, index) => {
      if (index < currentIndex) {
        return `- [x] ${step.label}`;
      }
      if (index === currentIndex) {
        return `- [ ] **${step.label}**`;
      }
      return `- [ ] ${step.label}`;
    })
    .join("\n");

  return `# ${state.title}\n\n**${state.progressLabel} · ${state.progressBar}**\n\n${state.description}\n\n${stepList}`;
}
