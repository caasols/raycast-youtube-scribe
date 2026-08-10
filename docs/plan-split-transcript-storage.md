# Plan: split transcript bodies out of the history index (schema v6)

## Problem

`View Transcript History` OOMs at Raycast's 100 MB JS heap limit once history accumulates.
Measured against the real code at 100 entries x 2500 segments:

| | |
| --- | --- |
| LocalStorage payload | 19.4 MB |
| retained as JS objects in React state | 44.6 MB (2.3x expansion) |
| `didMigrate` string built then discarded | 19.4 MB |
| markdown built for all rows (0.2 MB displayed) | 17.5 MB |
| **allocated per refresh tick (every 1.5-3 s)** | **~100 MB** |

Root cause: every read parses the entire transcript corpus, then does 2-3x redundant
work on top of it, on a repeating timer.

## Goal

The history list must never load transcript bodies. Only the one selected transcript
is hydrated. Memory becomes a function of the selected entry, not of history size.

## Storage model (schema v6)

Two kinds of key:

- `youtube-transcript-history` -> `{ version: 6, entries: HistoryEntry[] }`
  Index rows **never** carry `rawSegments`.
- `youtube-transcript-segments::<entryId>` -> `TranscriptSegment[]` (JSON)
  One key per transcript. Immutable once written.

`HistoryEntry` keeps `rawSegments?: TranscriptSegment[]` as an in-memory-only field, so
every existing consumer (`output.ts`, `export.ts`, search, AI prompts) works unchanged
once handed a hydrated entry. The invariant is about what gets *persisted*, enforced by test.

### New stored fields

The list detail pane derives duration, word count, and reading time from `rawSegments`
(`history-detail.ts:83,147`). Those must survive without segments, so we persist them once
at fetch time (and backfill during migration):

- `wordCount?: number`
- `transcriptDurationMs?: number`

Readers prefer the stored value and fall back to computing from segments when hydrated,
so hydrated and lean entries render identically.

## Migration v5 -> v6

Runs inside `loadHistory()`, guarded by `version < 6`, so it fires once.

Ordering makes it crash-safe and idempotent:

1. Parse the v5 blob.
2. For each entry: write its `...segments::<id>` key, compute `wordCount` /
   `transcriptDurationMs`, then `delete entry.rawSegments` so GC reclaims as we go.
3. Write the lean v6 index **last**, as a single `setItem`.

If interrupted, the v5 index is still intact and migration retries next launch. Segment
keys are content-addressed and immutable, so rewriting them is harmless.

Peak memory during the one-time migration is roughly the v5 parse (~65 MB at the sizes
above), which only fits once the waste below is removed. That is why those fixes are in
scope here rather than deferred.

## Prerequisite waste fixes (required for migration to fit)

1. **`history-persistence.ts:147`** - `deserializeHistory` builds a full re-serialization
   purely to compute `didMigrate`, and `loadHistory` explicitly discards it
   (`history-store.ts:25-31`). Drop it from the read path.
2. **`transcript-history.tsx:374`** - `renderItem` calls `buildHistoryDetailMarkdown` inside
   the `.map()`, so it runs for every row on every render. Track selection via
   `onSelectionChange`; build the pane only for the selected row.
3. **`transcript-history.tsx:101-107`** - `setInterval` reloads every 1.5-3 s and the effect
   depends on `history`, so the timer is rebuilt on every refresh. Poll only while an entry
   is `fetching`; stop when idle.

## API changes (`history-store.ts`)

```
loadHistory()                     -> lean index entries (runs migration if needed)
loadSegments(entryId)             -> TranscriptSegment[] | undefined
loadHydratedEntry(entryId)        -> HistoryEntry with segments
hydrateEntry(entry)               -> HistoryEntry with segments
saveHistory(entries)              -> persists segments for any entry carrying them, stores lean
prependHistory / patchHistoryEntry / patchHistoryEntryAndMoveToFront
                                  -> same split-on-write behaviour
removeHistoryEntry(id)            -> NEW: drops index row AND its segments key
clearHistory()                    -> drops index AND every segments key
```

`loadFreshEntry` in `lib/ai-cache.ts` is already the hydration point for the AI views, so
making it return a hydrated entry covers summary / ask / custom-action for free.

### Orphan segment keys

Any point where an entry leaves the index (remove, clear, retention prune) deletes its
segments key in the same operation. We deliberately do **not** sweep with
`LocalStorage.allItems()`, because that returns values and would load every transcript into
memory, reintroducing the bug. Residual risk: a crash between the two writes can strand one
segments key. Accepted; noted as a follow-up (a user-triggered maintenance action could
sweep explicitly).

## Views needing hydration

| View | Needs segments |
| --- | --- |
| `transcript-history.tsx` list pane | selected row only |
| `TranscriptDetailView` | yes |
| `TranscriptSearchView` | yes |
| `TranscriptSummaryView` / `TranscriptAskView` / `TranscriptCustomActionView` | yes, via `loadFreshEntry` |
| `AiChatsView` | no |
| `search-ai-chats.tsx` | no (gets much cheaper) |

Shared `useHydratedEntry(entry)` hook covers the view boundaries, with a loading state
while segments load.

## Steps

Each step keeps the suite green.

1. Add a memory regression test that fails today: loading N entries must retain under a
   fixed budget. This is the guard the whole change exists to satisfy.
2. Remove the throwaway re-serialization from the read path.
3. Add `wordCount` / `transcriptDurationMs`; make `history-detail.ts` prefer stored values.
4. Add the segments keyspace + split-on-write in `history-store.ts`.
5. Add the v5 -> v6 migration (idempotent, crash-safe, tested for interruption).
6. Add `useHydratedEntry`; hydrate the views in the table above.
7. History list: selection-driven pane, polling only while fetching.
8. Deletion paths drop segment keys (remove, clear, prune).
9. Verify: `RUN_YTDLP_SMOKE=1 npm test`, `npm run build`, `npm run lint`, plus a real
   end-to-end run in Raycast against the actual accumulated history.

## Risks

- **Raycast LocalStorage per-key/total limits are undocumented.** Today a single ~19 MB
  value already works, and we are splitting into smaller values, so this should only improve.
  Flagging it as unverified.
- **A caller forgetting to hydrate** silently sees an empty transcript rather than an error.
  Mitigated by routing hydration through the shared hook and `loadFreshEntry`, plus a test
  asserting the persisted index never contains `rawSegments`.
- **Migration on a corpus already near the limit.** The waste fixes land first (steps 2-3)
  precisely so the one-time migration has headroom.
