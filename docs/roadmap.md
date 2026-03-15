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

---

## Future Improvements

(No pending items — all planned features have been completed.)
