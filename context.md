---
updated: 2026-08-11
---

# Context: YouTube Transcribe

Working notes for whoever picks this up next. The map is [`CLAUDE.md`](CLAUDE.md);
shipped and candidate work is tracked in [`docs/roadmap.md`](docs/roadmap.md).

## What this is

A Raycast extension that turns a YouTube video into a durable, searchable local artifact.
It detects a video from the clipboard or focused browser tab, fetches captions with `yt-dlp`,
persists the result, and layers AI summaries, Q&A, transcript search, and multi-format export
on top of the saved history.

It is not a YouTube API client and not a browser automation project. It is a local shell around
`yt-dlp` plus Raycast UI and local persistence.

## Architecture

Seven layers, roughly in dependency order:

1. **Manifest** (`package.json`) declares six commands: three `view` commands the user runs, and
   three `no-view` background workers launched programmatically.
2. **Foreground orchestration** (`get-youtube-transcript.tsx`) resolves input, shows staged
   loading, launches the worker, and transitions to the detail view.
3. **Background execution** (`fetch-youtube-transcript-worker.ts`, `fetch-playlist-worker.ts`,
   `ai-summarize-worker.ts`) owns long-running work so it survives the window closing.
4. **Persistence** (`history-store.ts`, `lib/history-persistence.ts`) is the only path to stored
   state. See the storage model below.
5. **Provider** (`lib/ytdlp.ts`, `lib/ytdlp-command.ts`, `lib/ytdlp-metadata.ts`) shells out to
   `yt-dlp`, iterating player clients and cookie strategies before giving up.
6. **Presentation** (`lib/history-detail.ts`, `lib/output.ts`, `lib/transcript-search.ts`) builds
   view models and markdown; reading and searching are deliberately separate surfaces.
7. **AI** (`commands/transcript-history/transcript-ai.ts` and its views) runs in-extension via
   `useAI`, not by handing off to an external chat.

### Storage model (schema v6)

Two kinds of key:

- `youtube-transcript-history` holds `{version, entries}`. Index rows **never** carry
  `rawSegments`.
- `youtube-transcript-segments::<entryId>` holds one transcript body, written once.

`HistoryEntry.rawSegments` is an in-memory-only field. Anything that reads, searches, exports,
or prompts an AI over a transcript must hydrate first, via `hydrateEntry` / `loadHydratedEntry`
or the `useHydratedEntry` hook. Forgetting to hydrate fails silently with an empty transcript
rather than erroring, which is the main hazard in this codebase.

Because the index carries no bodies, `wordCount` and `transcriptDurationMs` are computed at
write time so the list can still render duration, word count, and reading time.

## Decisions and why

- **Transcripts are canonical as `rawSegments`, never as display text.** Keeps storage single
  sourced and lets output formats, search chunking, and exports all derive from one thing.
- **Long-running work belongs in a `no-view` worker.** A visible command's lifetime is tied to
  the window; background fetching was unreliable until this split.
- **Reading (`Detail`) and searching (`List`) are separate surfaces.** Hybrid screens were tried
  and rejected as worse.
- **Transcript bodies live outside the index (v6).** Loading every transcript to render a list
  exhausted Raycast's 100 MB heap. This was the fix, and it is why the hydration rule above
  exists.
- **Metadata fetching is non-fatal.** A transcript without metadata still has value. The cost is
  that metadata regressions fail silently, which is exactly how the `--ignore-no-formats-error`
  bug went unnoticed; be suspicious of empty metadata rather than assuming the video lacked it.
- **Raw debug logs are kept even though failures render in product language.** Diagnostics are
  reachable via Copy Debug Log without making the UI look like a terminal.

## Inventory

- `src/` 49 files. `src/lib/` holds pure helpers with near-total test coverage; `src/commands/`
  holds React views and orchestration.
- `tests/` 31 files, 186 tests, one skipped (the network smoke test, opt-in via
  `RUN_YTDLP_SMOKE=1`).
- `docs/` is gitignored except for tracked files already in git (`roadmap.md`, some specs).
- `graphify-out/` holds a semantically labelled code graph (20 communities, e.g.
  `History Store Persistence`, `Background Fetch Workers`, `Transcript Job Preparation`).
  Gitignored. Rebuild structure with `graphify update .` (free); relabel with
  `graphify label --backend=claude-cli` only when communities are added.

## Backlog

Open items only. Verify against the code before acting on any of these.

- **Confirm background fetch after the `interval` removal.** The three workers no longer declare
  `interval: "1h"`, which stopped pointless hourly wakeups. Launching still goes through
  `launchCommand`, but this has not been exercised end to end: run a fetch, close Raycast
  mid-way, confirm the transcript completes and no "Background worker did not start" toast fires.
- **Worker commands are visible in root search and cannot be hidden.** `disabledByDefault: true`
  was tried and Raycast ignores it for development extensions. Unknown whether it applies to
  store installs. No known fix; Raycast has no concept of a private command.
- **`docs/agent-handoff.md` is stale and untracked.** It documents schema v3 and a source path
  that no longer exists. Either update it against this document or delete it.
- **Two overlapping roadmaps.** `roadmap.md` (pre-open-source checklist) and `docs/roadmap.md`
  (shipped plus future work) should probably be consolidated.
- **Lint is red repo-wide** from a Prettier version bump, not from any specific change. A
  formatting-only pass would fix it but would bury real diffs; do it as its own commit.
- **Pre-open-source items** carried from `roadmap.md`: copy polish, extraction refactors, dead
  code audit, `package.json` metadata (`repository`, `homepage`, `bugs`, `keywords`),
  `CONTRIBUTING.md`, and backfilling `CHANGELOG.md`.
- **Feature candidates** are specified in `docs/roadmap.md` under Future Improvements:
  explain-a-passage (smallest, best starting point), AI chapters (most leverage), transcript
  translation, timestamped notes.
