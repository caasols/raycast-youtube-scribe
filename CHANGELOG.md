# Changelog

## [Unreleased]

### Fixed

- **Out of memory in View Transcript History.** Once history accumulated, opening the
  command could exhaust Raycast's 100 MB JS heap. Transcript bodies now live in their own
  per-entry storage keys (schema v6) instead of inline in one index blob, so the list loads
  metadata only and hydrates just the selected transcript. Existing history migrates
  automatically on first launch.
  - History index dropped from ~19 MB to ~0.4 MB at 100 entries.
  - Removed a full re-serialization of the whole store that ran on every read and whose
    result was discarded.
  - The detail pane is now built only for the selected row rather than for all rows.
  - The history list polls only while a fetch is in flight, instead of every 3 seconds.

- Scaffolded Raycast extension project
- Added first command: `get-youtube-transcript`
