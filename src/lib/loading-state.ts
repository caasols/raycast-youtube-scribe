export function getLoadingStateText(mode: "bootstrapping" | "auto-running"): {
  title: string;
  description: string;
} {
  if (mode === "auto-running") {
    return {
      title: "Opening Transcript History",
      description:
        "Fetching the detected YouTube transcript now. History will open automatically.",
    };
  }

  return {
    title: "Looking for a YouTube Source",
    description:
      "Checking the clipboard and focused browser tab before falling back to manual input.",
  };
}
