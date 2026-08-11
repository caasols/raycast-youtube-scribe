# Lint Green: Design Spec

## Goal

Make `ray lint` exit clean, and add the enforcement that would have prevented it going red in
the first place. The red light currently bundles three unrelated problems, one of which is a
user-facing defect and one of which blocks store publishing.

## Current State

`ray lint` exits with 4 errors, 0 warnings, across three stages: extension-metadata validation
(1 error), ESLint (4 `no-unused-vars` errors), and Prettier (19 files in `src/`). Investigation
on 2026-08-11 found these are three distinct problems, not one.

### 1. Formatting (19 files in `src/`, 32 including `tests/`)

`prettier` is declared as `^3.5.3`. The caret allowed it to resolve to `3.8.1` locally, while the
sibling repo `raycast-publico` still has `3.5.3` installed and lints green.

That difference is a coincidence, not the cause. Measured diffs against the current tree, across
`src/` and `tests/` together:

| Prettier version | Files changed | Lines changed |
|------------------|---------------|---------------|
| 3.5.3            | 34            | 1035          |
| 3.8.1            | 32            | 1005          |
| 3.9.6 (latest)   | 32            | 1001          |

`ray lint` only formats `src/`, so 19 of those 32 files are what it actually gates on. The
remaining 13 are in `tests/` and are invisible to both `ray lint` and the CI step added in
workstream D. They are included in the reformat anyway, since leaving a known-unformatted
directory behind would reintroduce the same drift by a different door.

Checking out `e414139` (2026-04-08, the last state pushed before today) and running Prettier
3.5.3 against it reports **32 files already unformatted**, before any version drift.

**This code has never been Prettier-clean.** The version bump is a red herring, which is why all
three versions produce near-identical churn. The note in `context.md` attributing the redness to
a version bump is incorrect and should be updated.

The real cause is the absence of enforcement: there is no CI and no pre-commit hook, so
`ray lint` has never had to pass. `raycast-publico` has a CI workflow; this repo has no
`.github/` directory at all.

There is no `.prettierrc` and no `prettier` key in `package.json`, so defaults apply.
`@raycast/eslint-config` declares `prettier` as a peer dependency at `>=2`, confirming `ray lint`
formats against the project's installed Prettier rather than a bundled copy. Pinning to any 3.x
is therefore safe.

### 2. Four unused variables, two of which are a live bug

| File | Symbol |
|------|--------|
| `src/commands/shared/transcript-detail-view.tsx:44` | `defaultAI` |
| `src/transcript-history.tsx:242` | `defaultAI` |
| `src/commands/transcript-history/transcript-ai.ts:2` | `DEFAULT_SUMMARIZE_PROMPT_TEMPLATE` |
| `src/lib/history-persistence.ts:93` | `_` |

Both `defaultAI` sites call `getDefaultAIAction()` and discard the result. Meanwhile
`package.json` declares a user-facing preference **Default AI Action** ("Choose which AI action
is triggered by default when pressing Enter on a transcript") with a Summarize/Ask dropdown.

The `ActionPanel` hardcodes `{summarizeAction}` first. Because Raycast binds Enter to the first
action in the panel, the preference has no effect regardless of what the user selects.

Both action elements already carry `key` props (`key="ask"`, `key="summarize"`), which React only
requires when rendering from an array. The original implementation almost certainly built an
ordered array from `defaultAI`; the ordering was lost and the `key` props and unused variable
were left behind.

### 3. Store metadata blocker

`metadata/youtube-scribe-1.png` is 6200x1748 (ratio 3.55:1). Raycast requires exactly 2000x1250
(ratio 1.6:1), so `ray lint` fails extension-metadata validation and `npm run publish` would be
blocked.

The file is a wide banner composing three Raycast windows side by side (history list, transcript
detail, AI summary). It cannot be cropped to 1.6:1 without losing two of the three panels. It is
3.4MB, tracked in git, and used as the README hero image at `README.md:9`.

`raycast-publico`, which is published and passes validation, uses this layout:

- `metadata/publico-{1,2,3}.png`, each exactly 2000x1250, roughly 600KB each
- `media/publico-hero.png` for the README hero
- `assets/` holding only `extension-icon.png`

## Design

Four workstreams, each landing as its own commit, in the order below.

### A. Formatting and version pin

1. Pin `prettier` to exact `3.9.6` in `devDependencies`, dropping the caret that allowed the
   drift.
2. Run `prettier --write` across `src/` and `tests/`. Expected: 32 files, ~1001 lines, no
   semantic change.
3. In a follow-up commit, add `.git-blame-ignore-revs` naming the reformat commit's SHA. It must
   be a separate commit because the SHA does not exist until the reformat lands. GitHub honours
   this file automatically; locally it needs
   `git config blame.ignoreRevsFile .git-blame-ignore-revs`.
4. Correct the `context.md` backlog entry, which currently states the redness came from a
   Prettier version bump. Replace it with the measured finding: the code was never
   Prettier-clean, and the absence of enforcement is the actual cause.

Latest (`3.9.6`) is chosen over the installed `3.8.1` because the churn is identical within 4
lines and it buys the longest runway before the next upgrade.

### B. Default AI Action, and genuine dead code

Add a pure helper to `src/lib/preferences.ts`, alongside the existing `getDefaultAIAction`:

```ts
export function orderAIActions(defaultAI: "summarize" | "ask"): ("summarize" | "ask")[] {
  return defaultAI === "ask" ? ["ask", "summarize"] : ["summarize", "ask"];
}
```

Both `transcript-detail-view.tsx` and `transcript-history.tsx` render the AI actions by mapping
over this array instead of hardcoding `{summarizeAction}` first. The existing `key` props then
serve their purpose.

The helper is extracted rather than inlined because `src/lib/` already holds pure helpers with
near-total test coverage, making the behaviour unit-testable without adding React test tooling
(`@testing-library` is not installed).

`DEFAULT_SUMMARIZE_PROMPT_TEMPLATE` and `_` are deleted **only after confirming they are
genuinely unreachable**, not merely unused at their definition site. If either turns out to be
load-bearing, that is a finding to report rather than silently work around.

### C. Store screenshots and README hero

Derive three 2000x1250 images from the existing banner using macOS `sips`:

1. For each of the three windows, crop a full-height, 1.6-ratio region (2797x1748) centred on
   that window, clamped to the image bounds.
2. Downscale each crop to exactly 2000x1250. Because the crop is larger than the target, this is
   a downscale, so nothing is upscaled or softened.
3. Write them to `metadata/youtube-transcribe-{1,2,3}.png`, matching `publico`'s convention.

Move the banner to `media/youtube-transcribe-hero.png` and update `README.md:9` to point there,
replacing the generic alt text "YouTube Transcribe Screenshot" with a descriptive one in
`publico`'s style.

These filenames follow the **extension** name, which is already correctly `youtube-transcribe`.
They are independent of the separate backlog item about the GitHub repo still being named
`raycast-youtube-scribe`. The three `README.md` references that depend on the repo name (the
clone URL at line 20, the `cd` at line 21, the issues link at line 130) are explicitly **out of
scope** and must remain untouched, because they are correct until the repo is renamed.

### D. Enforcement

Add `.github/workflows/ci.yml`, adapting `raycast-publico`'s, running on push and pull request
against `main`:

```
npm ci
npm run lint
npm test
npm run build
```

`npm run lint` is the step `publico`'s workflow omits, and its absence is why this rotted
unnoticed. CI is chosen over a pre-commit hook because hooks are not shared through git and
would require adding `husky`; CI needs no new dependency and cannot be bypassed locally.

Added last, so that it is green on its first run.

## Verification

| Workstream | How it is verified |
|------------|--------------------|
| A | `tsc --noEmit` clean and all 189 tests still pass. Prettier cannot change semantics, so a green suite against unmodified test logic is real evidence. `ray lint`'s Prettier stage passes. |
| B | New unit test covering both branches of `orderAIActions`. `ray lint`'s ESLint stage reports zero `no-unused-vars`. Manual check that Enter triggers the selected action. |
| C | `sips -g pixelWidth -g pixelHeight` reports exactly 2000x1250 for all three. `ray lint`'s metadata stage passes. Carlos eyeballs the crops for composition. |
| D | Workflow runs green on first push. |

Final gate: `ray lint` exits 0.

## Risks

- **The wide diff.** Mechanical and test-guarded. There is one branch and no open PRs, so there
  is nothing to conflict with; this is the cheapest available moment.
- **Dead symbols may not be dead.** Mitigated by confirming reachability before deleting.
- **Crop composition.** Automated cropping may frame a window awkwardly. Needs human review, not
  an automated check.
- **CI cost.** A public repo on GitHub Actions has free minutes; this workflow is small.

## Out of Scope

- Renaming the GitHub repo, the git remote, and the three repo-name references in `README.md`.
  Tracked separately in `context.md`.
- Consolidating the two overlapping roadmaps.
- Correcting the `context.md` backlog note that blames the redness on a Prettier version bump.
  The correction belongs with the work that proves it, so it is folded into workstream A rather
  than left as a separate task.
