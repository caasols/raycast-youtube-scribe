# YouTube Transcribe Roadmap

## What the Extension Is Today

**YouTube Transcribe** is a Raycast extension that fetches YouTube transcripts, stores them locally in history, and adds AI-powered workflows on top of them.

Current capabilities:

- Fetch transcripts from any valid YouTube video input
- History with persisted entries, retry flows, and error states
- Unified detail view with full AI-action parity across all entry points
- Transcript search with highlighted snippets, token-aware matching, and timestamp-based video actions
- AI actions: summarize transcript, ask AI about transcript — metadata-aware prompts with auto-saved results
- Enriched metadata: creator, thumbnail, tags, language, content kind (video, Short, live, premiere)
- Background-capable fetching with New badge, deep-link, and clear completion feedback
- Multi-format export: plain text, readable timestamped, JSON, SRT — copy or save to Downloads
- Structured error classification with actionable recovery guidance per error kind
- One-click diagnostic report for support and debugging workflows
- Configurable retention policy: history size cap and age-based pruning via preferences
- Normalized action ordering, pill hierarchy, and copy across all surfaces
- 3-step loading progress bar with consistent semantics

Architecture decisions that are fixed:

- History is the canonical cross-command state — not UI-transient state
- Reader (`Detail`) and search (`List`) are separate surfaces
- AI workflows are in-extension, not clipboard handoffs
- The background worker is the correct fetch architecture — do not regress to foreground-only

---

## Completed

1. ~~Fix direct-detail AI-action parity~~ — unified detail view shares all actions across entry points.
2. ~~Audit and normalize detail-view actions~~ — canonical ordering by status; destructive actions demoted.
3. ~~Audit and normalize search-view actions~~ — purpose-built action set for search surface.
4. ~~Verify and codify history sort order~~ — pure recency sort, tested with 100-entry cap.
5. ~~Audit pill and tag ordering~~ — canonical hierarchy: status, Short, channel, duration, language, saved date.
6. ~~Extension-wide copy inventory and rewrite~~ — normalized labels, toasts, and messages.
7. ~~Loading progress bar consistency~~ — 3-step bar with 16-char consistent semantics.
8. ~~Harden background worker deduplication~~ — explicit duplicate detection and concurrent launch handling.
9. ~~Richer failure classification~~ — distinct error kinds (timeout, no-captions, auth-required, private-or-deleted, rate-limited, ytdlp-missing) with structured recovery guidance.
10. ~~Improve background completion feedback~~ — stronger toasts, New badge on history, deep-link to completed transcript.
11. ~~Revisit transcript search quality~~ — token-aware matching, highlighted search snippets, improved exact vs. fuzzy logic.
12. ~~Timestamp-based video actions~~ — open YouTube video at the timestamp of a transcript search match.
13. ~~Transcript export variants~~ — plain text, readable timestamped, JSON, SRT formats with copy and save-to-file; AI summary auto-persistence.
14. ~~Metadata-aware AI prompts~~ — template placeholders for channel, content kind, duration, language, and tags in AI prompts.
15. ~~Richer content classification~~ — live and premiere content types detected from yt-dlp `live_status` metadata.
16. ~~Support and diagnostics workflows~~ — one-click diagnostic report copy bundle with environment, error, and debug details.
17. ~~Configurable retention policy~~ — user-configurable history size cap and max age pruning via extension preferences.
18. ~~Fix history store race condition~~ — removed side-effect write from `loadHistory()` to prevent background worker from overwriting foreground saves.
19. ~~Fix title fallback for restricted videos~~ — added yt-dlp metadata title to pipeline; entries now get real titles even when oembed API fails.
20. ~~Split transcript bodies out of the history index (schema v6)~~ : transcript bodies moved to per-entry `youtube-transcript-segments::<id>` keys. The history list loads metadata only and hydrates just the selected transcript. Fixes the "Command Out of Memory" crash at Raycast's 100 MB heap limit. Index dropped from roughly 19 MB to 0.4 MB at 100 entries.
21. ~~Restore video metadata~~ : added `--ignore-no-formats-error` to the yt-dlp metadata call. Format selection was failing YouTube's n-challenge, and because metadata is non-fatal every new fetch silently lost channel, thumbnail, duration, and engagement counts.

---

## Future Improvements

Ideas below are candidates, not commitments. Each should be brainstormed before
implementation, particularly around how it degrades when the AI output is poor.

A useful consequence of the v6 storage split: auxiliary per-entry data is now
cheap. Chapters, translations, and notes all fit the `<kind>::<entryId>` keyspace
without touching the history index, so none of them reintroduce the memory
problem that v6 solved.

### 1. Explain this passage

Add an "Explain with AI" action to a selected transcript segment, passing the
surrounding chunks as context so the explanation is grounded rather than
isolated.

- Why: the most keyboard-native of these ideas, and the transcript search surface
  already selects individual chunks.
- Plugs into: `commands/shared/transcript-search-view.tsx`, reusing the prompt
  machinery behind `buildCustomActionPrompt`.
- Effort: low. Best starting point of the four.

### 2. AI chapters

Generate a chapter breakdown with timestamps, rendered as a navigable index in
the detail view.

- Why: long transcripts currently read as one wall of text. Chapters turn the
  reader into an index and are the natural payoff for the timestamp deep links
  that already exist.
- Plugs into: new `chapters::<entryId>` key, plus a section in
  `lib/history-detail.ts`.
- Open question: generate on demand or at fetch time, and what to show when the
  model segments a video badly.
- Effort: medium. Highest leverage on how the extension feels.

### 3. Transcript translation and bilingual view

Translate the transcript itself into a target language, with a toggle for
original, translated, or aligned side-by-side.

- Why: the current `aiResponseLanguage` preference only affects AI answers. The
  transcript is never translated, which is a real gap for language learning.
- Plugs into: new `translation::<entryId>::<lang>` key, toggle in the detail view.
- Effort: medium to high. Cost and latency need thought for long transcripts.

### 4. Timestamped notes

Let the user write their own notes anchored to a timestamp, and fold them into
the Markdown export.

- Why: the extension stores AI output but nothing the user writes themselves.
- Plugs into: new `notes::<entryId>` key, a Form view, and `lib/export.ts`.
- Effort: medium.

### Deliberately not pursued

- Third-party transcript APIs such as Supadata: a strict downgrade from yt-dlp,
  which already handles captions, metadata, playlists, and auth-gated videos.
- Extracting key quotes as a built-in: already achievable through the existing
  custom AI action templates.

### Known open items

- `disabledByDefault` on the three background workers hides them from root
  search, but it is unverified whether `launchCommand` can still reach a disabled
  command. If it cannot, background fetching breaks and the flag must be reverted.
- `docs/agent-handoff.md` is untracked and stale: it still documents schema v3
  and a source path that no longer exists.
