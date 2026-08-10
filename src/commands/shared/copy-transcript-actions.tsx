import { Action, Clipboard, Icon, Toast, showToast } from "@raycast/api";
import { hydrateEntry } from "../../history-store";
import { buildRichTextHtml, materializeOutput } from "../../lib/output";
import type { HistoryEntry } from "../../types";

/**
 * Copy actions that fetch the transcript body on demand.
 *
 * `Action.CopyToClipboard` takes its content as a prop, which React evaluates
 * eagerly for every rendered row. In a list that meant building the full text of
 * every transcript on every render — and since schema v6 the rows are lean, so it
 * would also have copied nothing. Hydrating inside `onAction` fixes both.
 */
export function CopyTranscriptAction({ entry }: { entry: HistoryEntry }) {
  return (
    <Action
      title="Copy Transcript"
      icon={Icon.Clipboard}
      onAction={async () => {
        const full = await hydrateEntry(entry);
        await Clipboard.copy(materializeOutput(full, "text"));
        await showToast({
          style: Toast.Style.Success,
          title: "Transcript copied",
        });
      }}
    />
  );
}

export function CopyRichTextAction({ entry }: { entry: HistoryEntry }) {
  return (
    <Action
      title="Copy as Rich Text"
      icon={Icon.Clipboard}
      shortcut={{ modifiers: ["cmd", "shift"], key: "." }}
      onAction={async () => {
        const full = await hydrateEntry(entry);
        await Clipboard.copy({
          html: buildRichTextHtml(full),
          text: materializeOutput(full, "text"),
        });
        await showToast({
          style: Toast.Style.Success,
          title: "Copied as rich text",
        });
      }}
    />
  );
}
