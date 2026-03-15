# Transcript Export Variants — Design Spec

## Goal

Let users export transcripts in multiple formats (plain text, readable with timestamps, JSON, SRT) via both clipboard and file save, and persist AI-generated summaries so they can be re-exported later.

## Current State

All export is clipboard-only via `materializeOutput(entry, format)` which supports `"text"` (plain) and `"json"`. A `materializeDisplayOutput` variant uses `buildReadableTextOutput` for timestamp-prefixed paragraphs, but this is only used for the detail view markdown — not exposed as a copy/export action.

AI summaries (`TranscriptSummaryView`) and answers (`TranscriptAnswerView`) are ephemeral — generated on-demand via Raycast's `useAI` hook, displayed in a Detail view, and lost when the user navigates away. The only way to preserve them is manual "Copy Summary" / "Copy Answer".

## Design

### Export Formats

Four export formats for transcripts:

| Format | Extension | Description |
|--------|-----------|-------------|
| Plain text | `.txt` | Raw text without timestamps. Current `buildTextOutput`. |
| Readable | `.txt` | Timestamped paragraphs. New `buildPlainReadableOutput` that reuses `buildTranscriptParagraphs` from `output.ts` but formats timestamps without markdown bold (e.g. `[00:05]` instead of `**00:05**`). |
| JSON | `.json` | Raw segments array with `text`, `start_ms`, `duration_ms`. Current `buildJsonOutput`. |
| SRT | `.srt` | SubRip subtitle format. New. Useful for accessibility and video editing. |

### Export Module

New file: `src/lib/export.ts`

**`ExportFormat` type:** `"plain" | "readable" | "json" | "srt"`

**Relationship to `output.ts`:** The export module imports builder functions from `output.ts` (`buildTextOutput`, `buildJsonOutput`) and the `buildTranscriptParagraphs` helper (which must be exported from `output.ts`). It adds new functions for SRT and plain-readable formats. It does not duplicate or replace `output.ts`.

**Pure functions:**

1. **`buildPlainReadableOutput(rawSegments: TranscriptSegment[]): string`** — Reuses `buildTranscriptParagraphs` from `output.ts` but formats as `[MM:SS]\ntext` (no markdown bold). Produces plain-text-safe readable output.

2. **`buildSrtOutput(rawSegments: TranscriptSegment[]): string`** — Converts segments to SRT format. End timestamp for each entry is computed as `start_ms + duration_ms`. Format:
   ```
   1
   00:00:05,000 --> 00:00:10,500
   First subtitle line

   2
   00:00:10,500 --> 00:00:15,000
   Second subtitle line
   ```

3. **`exportTranscript(entry: HistoryEntry, format: ExportFormat): string`** — Dispatches to builder functions: `"plain"` → `buildTextOutput`, `"readable"` → `buildPlainReadableOutput`, `"json"` → `buildJsonOutput`, `"srt"` → `buildSrtOutput`. Returns empty string if `entry.rawSegments` is undefined or empty (export actions are only shown when `status === "finished"`, so this is a defensive fallback).

4. **`sanitizeFilename(title: string): string`** — Keeps only alphanumeric characters, hyphens, underscores, spaces, and periods. Replaces everything else with hyphens. Collapses consecutive hyphens. Truncates to 80 characters at a word boundary. Falls back to `"transcript"` if result is empty.

5. **`buildExportFilename(entry: HistoryEntry, format: ExportFormat): string`** — Returns `{sanitizedTitle}.{ext}` where ext is determined by format. On filename collision, overwrites the existing file (no deduplication).

**Side-effecting function:**

6. **`saveToDownloads(filename: string, content: string): Promise<string>`** — Writes content to `~/Downloads/{filename}`. Returns the full path. Uses Node's `fs.promises.writeFile`. Overwrites if the file already exists.

### AI Summary Persistence

Add to `HistoryEntry` in `src/types.ts`:

```typescript
aiSummary?: string;
```

**Auto-save behavior:** In both `TranscriptSummaryView` and `TranscriptAnswerView`, add a `useEffect` that watches `isLoading` and `data`. When `isLoading` transitions to `false` and `data` is non-empty and no error occurred, call `patchHistoryEntry(entry.id, { aiSummary: data })`.

Latest AI output overwrites previous — the field stores whichever summary or answer was generated most recently. This is acceptable because AI outputs are always re-generatable. The export submenu labels the stored content generically as "AI Summary" regardless of whether it was a summary or an answer — no distinction is made in the UI.

Note: `TranscriptAnswerView` is a private (non-exported) component inside `transcript-ask-view.tsx`. The `useEffect` for auto-save goes into this private component.

No schema migration needed — `aiSummary` is a new optional field with no backfill requirement.

### UI: Export Actions in Detail View

Replace the single "Copy Transcript" action in `TranscriptDetailView` with an `ActionPanel.Submenu` titled "Export":

```
Export >
  Copy as Plain Text
  Copy as Readable Text
  Copy as JSON
  Copy as SRT
  ---
  Save as Plain Text
  Save as Readable Text
  Save as JSON
  Save as SRT
  --- (only if entry.aiSummary exists)
  Copy AI Summary
  Save AI Summary
```

Each save action:
- Calls `saveToDownloads(buildExportFilename(entry, format), exportTranscript(entry, format))`
- Shows a success toast: "Saved to ~/Downloads/{filename}"
- Shows a failure toast on error

### UI: Save Actions in AI Views

In `TranscriptSummaryView`, add after "Copy Summary":
- "Save Summary to File" — saves `data` to `~/Downloads/{sanitizedTitle}-summary.md`

In `TranscriptAnswerView` (`TranscriptAnswerView` component), add after "Copy Answer":
- "Save Answer to File" — saves `data` to `~/Downloads/{sanitizedTitle}-answer.md`

### Integration with Auto-Copy

The existing auto-copy in `get-youtube-transcript.tsx` continues to use `materializeOutput(entry, "text")` — plain text format. The new export module does not change this behavior; it only adds new actions in the detail view.

### File Structure

| File | Change |
|------|--------|
| `src/types.ts` | Add `aiSummary` to `HistoryEntry` |
| `src/lib/output.ts` | Export `buildTranscriptParagraphs` and `formatTimestamp` |
| `src/lib/export.ts` | New: export format functions, file save |
| `src/commands/shared/transcript-detail-view.tsx` | Replace copy action with export submenu |
| `src/commands/transcript-history/transcript-summary-view.tsx` | Auto-save summary, add save-to-file action |
| `src/commands/transcript-history/transcript-ask-view.tsx` | Auto-save answer, add save-to-file action |
| `tests/export.test.ts` | New: tests for export functions |

### Testing

1. **`tests/export.test.ts`** (new):
   - `buildSrtOutput`: correct SRT format with sequence numbers, timestamps, text
   - `exportTranscript`: each format dispatches correctly
   - `sanitizeFilename`: strips unsafe chars, truncates, handles edge cases
   - `buildExportFilename`: correct extension per format
   - `saveToDownloads`: writes file to correct path (mocked `fs`)

2. **Manual testing:**
   - Export submenu appears in detail view with all actions
   - Copy actions produce correct clipboard content per format
   - Save actions create files in ~/Downloads with correct content
   - AI summary auto-saves after generation completes
   - AI summary appears in export submenu after generation
