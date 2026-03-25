import { Action, Icon, Toast, showToast } from "@raycast/api";
import { sanitizeFilename, saveToDownloads } from "../../lib/export";

export function SaveToFileAction({
  title,
  content,
  suffix,
}: {
  title: string;
  content: string;
  suffix: string;
}) {
  return (
    <Action
      title="Save to File"
      icon={Icon.SaveDocument}
      onAction={async () => {
        try {
          const filename = `${sanitizeFilename(title)}-${suffix}.md`;
          const path = await saveToDownloads(filename, content);
          await showToast({
            style: Toast.Style.Success,
            title: "Saved",
            message: path,
          });
        } catch (err) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Save failed",
            message: err instanceof Error ? err.message : "Unknown error.",
          });
        }
      }}
    />
  );
}
