# YouTube Transcribe

Raycast extension that fetches YouTube transcripts via `yt-dlp`, stores them locally,
and layers AI summaries, Q&A, search, and export on top.

- Status: actively maintained, published to the Raycast Store
- Stack: TypeScript, React, `@raycast/api`, vitest
- Current focus and open work: [`context.md`](context.md)

## Where things live

Ranked by connectivity in the code graph, most central first.

| Path | What it owns |
| --- | --- |
| [`src/types.ts`](src/types.ts) | `HistoryEntry`, the domain model everything hangs off (42 edges) |
| [`src/history-store.ts`](src/history-store.ts) | The only read/write path to persisted state, plus the v6 split-storage keyspace |
| [`src/lib/history-persistence.ts`](src/lib/history-persistence.ts) | Serialization, schema version, retention pruning, transcript stats |
| [`src/lib/ytdlp.ts`](src/lib/ytdlp.ts) | Provider layer: captions, metadata, playlists, diagnostics |
| [`src/get-youtube-transcript.tsx`](src/get-youtube-transcript.tsx) | Fetch command: input detection, loading UI, worker launch |
| [`src/transcript-history.tsx`](src/transcript-history.tsx) | History list: rows, selection-driven detail pane, actions |
| [`src/lib/history-detail.ts`](src/lib/history-detail.ts) | Shared detail view model and markdown rendering |
| [`src/commands/`](src/commands/) | Per-command orchestration and views, plus `shared/` |
| [`src/lib/`](src/lib/) | Pure, testable helpers: search, export, output, classification |
| [`tests/`](tests/) | vitest suite, one file per module; `tests/__mocks__/` fakes `@raycast/api` |
| [`docs/roadmap.md`](docs/roadmap.md) | Shipped work and candidate future work |

## Commands

```bash
npm test                      # vitest, 186 tests
RUN_YTDLP_SMOKE=1 npm test    # adds the live-network yt-dlp smoke test
npm run build                 # ray build, also deploys to Raycast
npm run dev                   # ray develop, watches and deploys
npm run lint                  # ray lint
```

Full verification gate before calling work done: all three of `RUN_YTDLP_SMOKE=1 npm test`,
`npm run build`, `npm run lint`.

## Gotcha that will waste your time

`ray develop` deploys to stable Raycast (`~/.config/raycast/`). Raycast **Beta** loads from
`~/.config/raycast-x/` and will silently keep running an old build, so your changes appear to
do nothing at all. Target Beta with `--target x`, or set `{"Target": "x"}` in
`~/.config/raycast/config.json`. See the Development section of [`README.md`](README.md).

## Deep navigation

A code graph is built in [`graphify-out/`](graphify-out/) (`graph.json`, `graph.html`,
`GRAPH_REPORT.md`). Use `graphify query`, `graphify path`, and `graphify explain` to trace
call paths and find hubs. Rebuild after code changes with `graphify update .` (free, no LLM).
