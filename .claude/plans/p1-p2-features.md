# P1 + P2 Feature Implementation Plan

## P1 Features

### 1. Quick Summary Preview in History List
**Goal:** Show cached summary above the raw transcript in the detail pane.

**Files:** `src/lib/history-detail.ts` (where `buildHistoryDetailMarkdown` lives)

**Approach:**
- In `buildHistoryDetailMarkdown`, check if `entry.aiSummaries?.[0]` exists
- If yes, prepend a `## Summary` section with the cached summary content, followed by a `---` separator, then the existing transcript markdown
- Only on the `history-pane` surface (not `full-detail`) to keep the detail view clean

---

### 2. AI Chat Count Badge
**Goal:** Show "3 chats" accessory next to history entries that have cached AI responses.

**Files:** `src/transcript-history.tsx`

**Approach:**
- Compute `aiChatCount = (entry.aiSummaries?.length ?? 0) + (entry.aiAnswers?.length ?? 0)`
- If `> 0`, add an accessory `{ icon: Icon.Stars, text: "${count}" }` to the `List.Item`

---

### 3. Timestamp Deep Links
**Goal:** From the transcript search view, open the video at the exact timestamp.

**Files:** `src/commands/shared/transcript-search-view.tsx`

**Status:** Already implemented! The search view has `Action.OpenInBrowser` with `url={entry.url}&t=${Math.floor(chunk.start_ms / 1000)}`. No work needed.

Also check the detail view — if the readable output already renders clickable timestamp links via `buildReadableTextOutput`, this is covered there too.

---

### 4. Transcript Word Count & Reading Time
**Goal:** Show word count and reading time in the detail pane and history list.

**Files:** `src/lib/history-detail.ts`, `src/transcript-history.tsx`

**Approach:**
- **Detail pane:** In `buildHistoryDetailMarkdown`, compute word count from `buildTextOutput(entry.rawSegments)` using `countWords()`. Add a metadata line like `**1,234 words** · **6 min read**` below the title.
- **History list:** Add an accessory `{ text: "1.2K words" }` using `formatCompactNumber(countWords(...))`. Only compute for `status === "finished"` entries to avoid unnecessary work.

---

### 5. Word Count & Reading Time for AI Responses
**Goal:** Show word count and reading time on summary/answer cached views.

**Files:** `src/commands/transcript-history/ai-chats-view.tsx`

**Status:** Already implemented! `AiChatDetail` already shows `countWords(content)` and `readingTimeLabel(words)` in the markdown. The list items also show `{ text: "${countWords(...)}w" }` as an accessory. No work needed.

---

### 6. Engagement Metrics in Detail View
**Goal:** Show view count, like count, comment count from `VideoMetadata`.

**Files:** `src/lib/history-detail.ts`

**Approach:**
- In `buildHistoryDetailMarkdown`, check `entry.videoMetadata`
- If it exists, add metadata fields:
  - `viewCount` → format with `formatCompactNumber` → e.g., "1.2M views"
  - `likeCount` → "12K likes"
  - `commentCount` → "340 comments"
- Add these as a line in the metadata section of the detail markdown
- Need to check what fields `VideoMetadata` actually has — read the type definition

---

### 7. Favorite/Pin Transcripts
**Goal:** Pin transcripts to the top of the history list.

**Files:** `src/transcript-history.tsx`, `src/history-store.ts`, `src/types.ts`

**Status:** Already partially implemented! The history view already has:
- Pinned/unpinned sections in the list
- Pin/Unpin actions
- `entry.pinned` field on `HistoryEntry`

Verify this is fully working. If it is, no work needed.

---

### 8. History Sort Options (Extension Preference)
**Goal:** Let users choose default sort order in extension settings.

**Files:** `src/lib/preferences.ts`, `src/transcript-history.tsx`, `package.json`

**Status:** Already implemented! `package.json` has the `historySortOrder` preference with options (newest, oldest, title-asc, title-desc, channel), and `getHistorySortOrder()` exists in preferences. Verify it's wired into the history list sorting logic.

---

### 9. Copy Individual Segment
**Goal:** Copy just a matched segment with its timestamp from transcript search.

**Files:** `src/commands/shared/transcript-search-view.tsx`

**Status:** Already implemented! The search view has `Action.CopyToClipboard` with `content={[${formatTranscriptTimestamp(chunk.start_ms)}] ${chunk.text}}`. No work needed.

---

### 10. Configurable AI Model (including BYOK)
**Goal:** Let users pick Raycast AI models or bring their own key.

**Files:** `src/lib/preferences.ts`, `package.json`

**Status:** Partially implemented. `getAiModel()` exists and returns a model string. The `aiModel` preference exists in `preferences.ts` type but need to check if it's in `package.json` with proper dropdown options.

**Approach:**
- Verify `package.json` has the `aiModel` preference with appropriate options
- Check Raycast API docs for available model identifiers
- BYOK: Raycast supports this natively via the `AI.ask()` API — users configure API keys in Raycast settings, not in the extension. So we just need to expose the model selector. No custom key management needed.

---

## P2 Features

### 11. Auto-Summarize on Fetch
**Goal:** Preference to automatically trigger background summarization when a transcript finishes fetching.

**Files:** `package.json`, `src/lib/preferences.ts`, `src/get-youtube-transcript.tsx`, `src/fetch-youtube-transcript-worker.ts`

**Approach:**
- Add `autoSummarize` boolean preference in `package.json` (default: false)
- Add `getAutoSummarize()` reader in `preferences.ts`
- In `get-youtube-transcript.tsx`: after a transcript finishes (`status: "finished"`), if `getAutoSummarize()` is true, launch the `ai-summarize-worker` background command with the entry ID
- In `fetch-youtube-transcript-worker.ts`: after a background transcript completes, same check — if auto-summarize is on, launch the AI worker
- The AI worker already handles the full flow (prompt building, `AI.ask()`, save, toast)

---

### 12. Jump Between Summary and Q&A
**Goal:** From summary view, `⌘⇧A` jumps to ask; from ask view, `⌘⇧S` jumps to summary.

**Files:** `src/commands/transcript-history/transcript-summary-view.tsx`, `src/commands/transcript-history/transcript-ask-view.tsx`

**Approach:**
- In `CachedSummaryDetail` (summary view): add an `Action.Push` with shortcut `⌘⇧A` that pushes `<TranscriptAskView entry={entry} />`
- In `CachedAnswerDetail` (ask view): add an `Action.Push` with shortcut `⌘⇧S` that pushes `<TranscriptSummaryView entry={entry} />`
- Also add these actions in the streaming/generating state panels so users don't have to wait

---

### 13. Retry with Exponential Backoff
**Goal:** Auto-retry transient failures (rate limits, timeouts) without manual intervention.

**Files:** `src/commands/get-youtube-transcript/transcript-job.ts` (where `runPreparedTranscriptJob` lives), possibly `src/fetch-youtube-transcript-worker.ts`

**Approach:**
- Wrap the fetch call in `runPreparedTranscriptJob` with a retry loop
- Retry only for transient error kinds: `"timeout"`, `"rate-limited"`
- Schedule: 3 attempts with delays of 2s, 4s, 8s (exponential)
- Update `statusMessage` during retries so the UI shows "Retrying (attempt 2/3)..."
- If all retries fail, fall through to the existing error handling
- Apply the same retry logic in the background worker

---

### 14. Markdown Export
**Goal:** Export full transcript as formatted Markdown with metadata header.

**Files:** `src/lib/export.ts`, `src/commands/shared/transcript-detail-view.tsx`

**Approach:**
- Add `buildMarkdownOutput(entry: HistoryEntry): string` to `export.ts`:
  ```
  # {title}

  **Channel:** {channel}
  **URL:** {url}
  **Date:** {date}
  **Duration:** {duration}
  **Language:** {language}

  ---

  ## Transcript

  [Readable text output with timestamps]
  ```
- Add `"markdown"` to the `ExportFormat` type
- Add `buildExportFilename` case for `.md` extension
- Add the export action to the detail view's export submenu

---

### 15. Custom Action Prompt Templates (×2)
**Goal:** Two user-configurable custom AI actions. If configured, they appear in menus. Answers are stored alongside regular AI answers.

**Files:** `package.json`, `src/lib/preferences.ts`, `src/commands/transcript-history/transcript-ai.ts`, `src/transcript-history.tsx`, `src/commands/shared/transcript-detail-view.tsx`, `src/commands/transcript-history/ai-chats-view.tsx`, `src/types.ts`

**Approach:**

**Preferences (package.json):**
- `customAction1Name`: text field, default empty (e.g., "Extract Key Quotes")
- `customAction1Prompt`: text field, default empty (supports same `{{title}}`, `{{url}}`, `{{transcript}}` variables)
- `customAction2Name`: text field, default empty (e.g., "Extract Action Items")
- `customAction2Prompt`: text field, default empty

**Preference readers (preferences.ts):**
- `getCustomActions(): { name: string; prompt: string }[]` — returns 0-2 entries, filtering out any where name or prompt is empty

**Prompt building (transcript-ai.ts):**
- `buildCustomActionPrompt(entry, template)` — same interpolation logic as `buildTranscriptSummaryPrompt` but with the custom template. Append language instruction.

**Storage (types.ts):**
- Reuse `CachedAiAnswer` — store custom action responses as answers where `question` = the custom action name (e.g., "Extract Key Quotes"). This way they naturally appear in AI Chats view and Search AI Chats.

**Execution view:**
- Create a new `TranscriptCustomActionView` component (or reuse `TranscriptAskView` pattern) that:
  - Takes `entry`, `actionName`, `promptTemplate` as props
  - Checks cache: `findCachedAnswer(entry, actionName)`
  - If cached, shows cached result immediately
  - If not, runs `useAI` with the built prompt, saves as answer on completion
  - Supports "Regenerate" and "Regenerate as New" like summary view

**Menu integration (transcript-history.tsx, transcript-detail-view.tsx):**
- Call `getCustomActions()` at render time
- For each configured action, add an `Action.Push` to the action panel:
  - Title: the custom action name
  - Icon: `Icon.Stars`
  - Target: `<TranscriptCustomActionView entry={entry} actionName={name} promptTemplate={prompt} />`
- Only show these actions for `status === "finished"` entries
- Place them after the built-in Summarize/Ask actions

**AI Chats integration:**
- No changes needed — custom action responses are stored as `CachedAiAnswer` entries, so they already appear in the AI Chats view and Search AI Chats view naturally.

---

## Implementation Order

1. **Items with no work needed** (verify only): #3, #5, #7, #8, #9 — just confirm they're working
2. **Quick additions**: #2 (badge), #4 (word count in detail/list), #6 (engagement metrics)
3. **Small features**: #1 (summary preview), #10 (AI model preference in package.json), #12 (jump actions), #14 (markdown export)
4. **Medium features**: #11 (auto-summarize), #13 (retry backoff)
5. **Largest feature**: #15 (custom action templates)

Estimated: ~5 items need verification only, ~4 are small additions, ~4 are medium, and 1 is larger (custom actions).
