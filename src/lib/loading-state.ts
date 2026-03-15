export function getLoadingStateText(mode: "bootstrapping" | "auto-running"): {
  title: string;
  description: string;
} {
  if (mode === "auto-running") {
    return {
      title: "Preparing Transcript Details",
      description:
        "Fetching the detected YouTube transcript now. The detail view will open automatically when it is ready.",
    };
  }

  return {
    title: "Looking for a YouTube Source",
    description:
      "Checking the clipboard and focused browser tab before falling back to manual input.",
  };
}
