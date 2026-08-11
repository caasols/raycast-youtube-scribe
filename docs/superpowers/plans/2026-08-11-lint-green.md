# Lint Green Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ray lint` exit 0, fix the live Default AI Action bug it was hiding, unblock store publishing, and add CI so it cannot rot again.

**Architecture:** Six independent commits in order. The wide mechanical reformat lands first and alone, so later functional diffs stay readable. Behaviour changes are driven by a pure helper in `src/lib/` so they are unit-testable without React test tooling. CI lands last so it is green on its first run.

**Tech Stack:** TypeScript, React (Raycast), vitest, Prettier, ESLint via `@raycast/eslint-config`, macOS `sips` for image work, GitHub Actions.

## Global Constraints

- Branch: `chore/lint-green`. Already created. Do not work on `main`.
- Never run `git config user.email` / `user.name`, or set `GIT_AUTHOR_EMAIL`. Identity is already configured.
- No em-dashes and no emojis in any code, comment, commit message, or doc.
- Prettier pinned to exact `3.9.6`, no caret.
- Store screenshots must be exactly 2000x1250 pixels.
- Do not touch `README.md` lines 20, 21, or 130. Those reference the GitHub repo name `raycast-youtube-scribe`, which is still correct and is tracked as separate backlog work.
- The full suite is 189 passing tests plus 1 skipped. That count must never drop.
- Spec: `docs/superpowers/specs/2026-08-11-lint-green-design.md`.

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `package.json` | Pin `prettier` to `3.9.6` | 1 |
| all of `src/`, `tests/` | Prettier reformat, no semantic change | 1 |
| `.git-blame-ignore-revs` | Create. Hides the reformat commit from blame | 2 |
| `context.md` | Correct the incorrect Prettier-version diagnosis | 2 |
| `src/lib/preferences.ts` | Add pure `orderAIActions` helper | 3 |
| `tests/preferences.test.ts` | Create. Covers both ordering branches | 3 |
| `src/commands/shared/transcript-detail-view.tsx` | Render AI actions in preference order | 3 |
| `src/transcript-history.tsx` | Same, for the list view | 3 |
| `src/commands/transcript-history/transcript-ai.ts` | Remove dead export | 4 |
| `src/lib/history-persistence.ts` | Remove unused binding | 4 |
| `metadata/youtube-transcribe-{1,2,3}.png` | Create. Compliant store screenshots | 5 |
| `metadata/youtube-scribe-1.png` | Delete. Wrong size, blocks publish | 5 |
| `media/youtube-transcribe-hero.png` | Create. README hero, moved out of lint's path | 5 |
| `README.md:9` | Repoint hero image, improve alt text | 5 |
| `.github/workflows/ci.yml` | Create. Enforces lint, test, build | 6 |

---

### Task 1: Pin Prettier and reformat

**Files:**
- Modify: `package.json` (devDependencies)
- Modify: `package-lock.json` (generated)
- Modify: every unformatted file under `src/` and `tests/`

**Interfaces:**
- Consumes: nothing.
- Produces: a commit SHA that Task 2 records in `.git-blame-ignore-revs`.

- [ ] **Step 1: Record the baseline so the reformat can be proven safe**

```bash
cd /Users/caraujo/Documents/raycast-youtube-transcribe
npx vitest run 2>&1 | tail -4
npx tsc --noEmit && echo "tsc clean"
```

Expected: `189 passed | 1 skipped`, and `tsc clean`. If the baseline is not green, stop and report. Do not reformat on top of a red tree.

- [ ] **Step 2: Pin Prettier to an exact version**

Edit `package.json`, in `devDependencies`, change:

```json
"prettier": "^3.5.3",
```

to:

```json
"prettier": "3.9.6",
```

The caret is what allowed the drift to 3.8.1. Removing it is the point of this step.

- [ ] **Step 3: Install the pinned version**

```bash
npm install
node -e "console.log(require('prettier/package.json').version)"
```

Expected: prints `3.9.6`.

- [ ] **Step 4: Reformat**

```bash
npx prettier --write "src/**/*.{ts,tsx}" "tests/**/*.{ts,tsx}"
```

Expected: roughly 32 files reported as changed.

- [ ] **Step 5: Prove nothing broke**

```bash
npx tsc --noEmit && echo "tsc clean"
npx vitest run 2>&1 | tail -4
npx prettier --check "src/**/*.{ts,tsx}" "tests/**/*.{ts,tsx}"
```

Expected: `tsc clean`; `189 passed | 1 skipped`; and `All matched files use Prettier code style!`.

Prettier cannot change program semantics, so an unchanged green suite is genuine evidence. If any test fails, stop and report it rather than editing the test.

- [ ] **Step 6: Confirm the Prettier stage of ray lint is now clean**

```bash
npx ray lint 2>&1 | grep -c "Code style issues"
```

Expected: `0`. Other stages (metadata, ESLint) still fail; those are Tasks 4 and 5.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src tests
git commit -F - <<'EOF'
style: format the codebase with Prettier 3.9.6

Formatting only, no behaviour change. Verified with tsc and the full 189-test
suite before and after.

Prettier was declared as ^3.5.3 and the caret let it drift to 3.8.1 locally.
Pinning to an exact version removes that class of surprise. The version is not
why lint was red: measured against this tree, 3.5.3 changes 34 files, 3.8.1
changes 32, and 3.9.6 changes 32, and the tree at e414139 was already
unformatted under 3.5.3. This code had simply never been formatted.

tests/ is included even though ray lint only checks src/, so no directory is
left as a known-unformatted foothold for the same drift.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Hide the reformat from blame, and correct the record

**Files:**
- Create: `.git-blame-ignore-revs`
- Modify: `context.md` (Backlog section)

**Interfaces:**
- Consumes: the commit SHA produced by Task 1.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Capture the reformat SHA**

```bash
git log -1 --format=%H
```

Copy the full 40-character SHA. It is referred to below as `<REFORMAT_SHA>`.

- [ ] **Step 2: Create the ignore file**

Create `.git-blame-ignore-revs` with this content, substituting the real SHA:

```
# Revisions listed here are skipped by git blame.
# Enable locally with:
#   git config blame.ignoreRevsFile .git-blame-ignore-revs
# GitHub honours this file automatically.

# style: format the codebase with Prettier 3.9.6
<REFORMAT_SHA>
```

- [ ] **Step 3: Enable it locally and verify it works**

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
git blame -L 1,5 src/lib/preferences.ts | head -5
```

Expected: the listed commits are ordinary feature commits, not the reformat SHA.

- [ ] **Step 4: Correct the backlog note in `context.md`**

In the `## Backlog` section, replace this bullet:

```markdown
- **Lint is red repo-wide** from a Prettier version bump, not from any specific change. A
  formatting-only pass would fix it but would bury real diffs; do it as its own commit.
```

with:

```markdown
- **Lint had never been green, and the Prettier version was a red herring.** Measured on
  2026-08-11: 3.5.3 changed 34 files, 3.8.1 changed 32, 3.9.6 changed 32, and the tree at
  `e414139` was already unformatted under 3.5.3. The code had simply never been formatted.
  The real cause was that nothing enforced the check. Fixed by formatting once, pinning
  Prettier exactly, and adding CI that runs `npm run lint`.
```

- [ ] **Step 5: Commit**

```bash
git add .git-blame-ignore-revs context.md
git commit -F - <<'EOF'
chore: ignore the reformat in blame and correct the lint note

The context.md backlog blamed a Prettier version bump. Measurement disproved
that, so the note now records what was actually found and what fixed it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Make the Default AI Action preference work

**Files:**
- Modify: `src/lib/preferences.ts` (add export beside `getDefaultAIAction`)
- Create: `tests/preferences.test.ts`
- Modify: `src/commands/shared/transcript-detail-view.tsx` (lines 44, 76, 91)
- Modify: `src/transcript-history.tsx` (lines 242, 269, 284)

**Interfaces:**
- Consumes: existing `getDefaultAIAction(): "summarize" | "ask"` from `src/lib/preferences.ts`.
- Produces: `orderAIActions(defaultAI: "summarize" | "ask"): ("summarize" | "ask")[]`, exported from `src/lib/preferences.ts`.

Background: `package.json` declares a `defaultAIAction` preference ("Choose which AI action is triggered by default when pressing Enter on a transcript"). Both views call `getDefaultAIAction()` and discard the result, while the panel hardcodes `summarizeAction` first. Raycast binds Enter to the first action in the panel, so the preference currently does nothing. Both action elements already carry `key` props, which React only needs for arrays, indicating the ordering existed once and was lost.

- [ ] **Step 1: Write the failing test**

Create `tests/preferences.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { orderAIActions } from "../src/lib/preferences";

describe("orderAIActions", () => {
  // Raycast binds Enter to the first action in an ActionPanel, so ordering is
  // the whole mechanism behind the Default AI Action preference.
  it("puts summarize first when the preference is summarize", () => {
    expect(orderAIActions("summarize")).toEqual(["summarize", "ask"]);
  });

  it("puts ask first when the preference is ask", () => {
    expect(orderAIActions("ask")).toEqual(["ask", "summarize"]);
  });

  it("always returns both actions exactly once", () => {
    for (const pref of ["summarize", "ask"] as const) {
      expect([...orderAIActions(pref)].sort()).toEqual(["ask", "summarize"]);
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npx vitest run tests/preferences.test.ts
```

Expected: FAIL. The import cannot resolve `orderAIActions` because it does not exist yet.

- [ ] **Step 3: Implement the helper**

In `src/lib/preferences.ts`, immediately after the existing `getDefaultAIAction` function, add:

```ts
/**
 * Order of the two AI actions in an ActionPanel.
 *
 * Raycast binds Enter to the first action in the panel, so putting the
 * preferred action first is what makes the Default AI Action preference take
 * effect. Kept as a pure function so it is testable without React.
 */
export function orderAIActions(
  defaultAI: "summarize" | "ask",
): ("summarize" | "ask")[] {
  return defaultAI === "ask" ? ["ask", "summarize"] : ["summarize", "ask"];
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
npx vitest run tests/preferences.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Wire it into the detail view**

In `src/commands/shared/transcript-detail-view.tsx`, line 27 currently reads:

```ts
import { getCustomActions, getDefaultAIAction } from "../../lib/preferences";
```

Change it to:

```ts
import { getCustomActions, getDefaultAIAction, orderAIActions } from "../../lib/preferences";
```

Then, immediately after the `summarizeAction` definition ends (after line 76 in the pre-edit file, i.e. after the closing `);` of `const summarizeAction = (...)`), add:

```tsx
  const [firstAIAction, secondAIAction] = orderAIActions(defaultAI).map((kind) =>
    kind === "summarize" ? summarizeAction : askAction,
  );
```

Replace line 76, which reads `{summarizeAction}`, with:

```tsx
              {firstAIAction}
```

Replace line 91, which reads `{askAction}`, with:

```tsx
              {secondAIAction}
```

This preserves the existing layout deliberately: one AI action, then the custom actions, then the other AI action. Only which one occupies the first slot changes.

- [ ] **Step 6: Wire it into the history view**

In `src/transcript-history.tsx`, line 38 currently reads:

```ts
import { getCustomActions, getDefaultAIAction, getHistorySortOrder } from "./lib/preferences";
```

Change it to:

```ts
import {
  getCustomActions,
  getDefaultAIAction,
  getHistorySortOrder,
  orderAIActions,
} from "./lib/preferences";
```

Prettier 3.9.6 will wrap this import across lines at the default 80-column width, so writing it pre-wrapped keeps the file formatted.

`defaultAI` is defined at line 242, outside the `rowActions` callback, while `askAction` and `summarizeAction` are defined inside it at lines 246 and 255. So place the destructuring inside `rowActions`, after the `summarizeAction` definition ends:

```tsx
    const [firstAIAction, secondAIAction] = orderAIActions(defaultAI).map((kind) =>
      kind === "summarize" ? summarizeAction : askAction,
    );
```

Replace line 269, `{summarizeAction}`, with `{firstAIAction}`.
Replace line 284, `{askAction}`, with `{secondAIAction}`.

- [ ] **Step 7: Verify the whole suite and the unused-variable errors for `defaultAI`**

```bash
npx tsc --noEmit && echo "tsc clean"
npx vitest run 2>&1 | tail -4
npx ray lint 2>&1 | grep "defaultAI" || echo "no defaultAI errors remain"
```

Expected: `tsc clean`; `192 passed | 1 skipped` (189 plus the 3 new); and `no defaultAI errors remain`.

- [ ] **Step 8: Verify by hand in the real extension**

```bash
npm run dev
```

In Raycast, set the extension preference "Default AI Action" to **Ask AI About This Transcript**. Open any finished transcript. Confirm the first action in the panel is the Ask action and that pressing Enter opens it. Switch the preference back to Summarize and confirm the order flips. Stop `ray develop` when done.

This is the only step that proves the user-facing bug is actually fixed; the unit test proves only the ordering logic.

- [ ] **Step 9: Commit**

```bash
git add src/lib/preferences.ts tests/preferences.test.ts src/commands/shared/transcript-detail-view.tsx src/transcript-history.tsx
git commit -F - <<'EOF'
fix: honour the Default AI Action preference

Both views called getDefaultAIAction() and threw the result away while the
ActionPanel hardcoded Summarize first. Raycast binds Enter to the first action,
so the preference did nothing no matter what the user chose. The leftover `key`
props on both action elements, which React only needs for arrays, suggest the
ordering existed once and was lost.

Ordering now comes from a pure orderAIActions helper in lib/, unit tested on
both branches. The panel layout is unchanged; only which action holds the first
slot moves.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Remove the genuinely dead symbols

**Files:**
- Modify: `src/commands/transcript-history/transcript-ai.ts:2`
- Modify: `src/lib/history-persistence.ts:93`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Prove `DEFAULT_SUMMARIZE_PROMPT_TEMPLATE` is unreachable before deleting it**

```bash
grep -rn "DEFAULT_SUMMARIZE_PROMPT_TEMPLATE" src/ tests/ package.json
```

Expected: exactly one hit, its own definition in `src/commands/transcript-history/transcript-ai.ts`.

If there is more than one hit, it is in use. Stop, do not delete it, and report the finding. A prompt template referenced from `package.json` preference defaults would be load-bearing despite looking dead.

- [ ] **Step 2: Delete it**

Remove the `DEFAULT_SUMMARIZE_PROMPT_TEMPLATE` declaration from `src/commands/transcript-history/transcript-ai.ts`. If it was the only thing imported on its import line, remove that import line too.

- [ ] **Step 3: Inspect the unused binding in `history-persistence.ts`**

```bash
sed -n '88,98p' src/lib/history-persistence.ts
```

This is at line 93 and is named `_`, which is the conventional name for a deliberately discarded value, most often from array destructuring or a callback parameter. Read the surrounding code before changing it.

- [ ] **Step 4: Remove the unused binding without changing behaviour**

Apply whichever fits what Step 3 showed:

- Destructuring such as `const [_, rest] = ...`: use a hole instead, `const [, rest] = ...`.
- An unused callback parameter such as `(_, i) => ...`: keep the position if later parameters are used; ESLint's default `argsIgnorePattern` does not cover it, so removing trailing unused parameters is preferred where possible.
- A genuinely unused `const _ = ...`: delete the line, but only if the right-hand side has no side effects. If it calls a function, the call may matter. Preserve the call and drop only the binding.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && echo "tsc clean"
npx vitest run 2>&1 | tail -4
npx ray lint 2>&1 | grep -c "no-unused-vars"
```

Expected: `tsc clean`; `192 passed | 1 skipped`; and `0` unused-variable errors.

- [ ] **Step 6: Commit**

```bash
git add src/commands/transcript-history/transcript-ai.ts src/lib/history-persistence.ts
git commit -F - <<'EOF'
chore: drop two genuinely unused symbols

Both confirmed unreachable before removal. The other two unused-variable errors
were the Default AI Action bug and are fixed separately.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Compliant store screenshots and README hero

**Files:**
- Create: `metadata/youtube-transcribe-1.png`, `-2.png`, `-3.png` (2000x1250 each)
- Create: `media/youtube-transcribe-hero.png`
- Delete: `metadata/youtube-scribe-1.png`
- Modify: `README.md:9`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

Background: the current file is 6200x1748 and Raycast requires exactly 2000x1250, so `ray lint` fails metadata validation and `npm run publish` would be blocked. It is a wide banner of three Raycast windows side by side. The crop offsets below were derived from the window positions and verified visually on 2026-08-11.

- [ ] **Step 1: Preserve the banner as the README hero**

```bash
mkdir -p media
git mv metadata/youtube-scribe-1.png media/youtube-transcribe-hero.png
sips -g pixelWidth -g pixelHeight media/youtube-transcribe-hero.png
```

Expected: 6200 x 1748. `media/` is not validated by `ray lint` and is not bundled into the published extension, unlike `assets/`.

- [ ] **Step 2: Generate the three compliant screenshots**

```bash
cd /Users/caraujo/Documents/raycast-youtube-transcribe
for i in 1 2 3; do
  case $i in
    1) X=179 ;;
    2) X=2129 ;;
    3) X=4077 ;;
  esac
  sips -c 1214 1943 --cropOffset 268 $X media/youtube-transcribe-hero.png \
    --out "metadata/youtube-transcribe-$i.png" >/dev/null
  sips -z 1250 2000 "metadata/youtube-transcribe-$i.png" \
    --out "metadata/youtube-transcribe-$i.png" >/dev/null
done
```

Each crop is 1943x1214 (ratio 1.6) positioned so exactly one window is framed with even padding and no bleed from its neighbours, then scaled to the required 2000x1250.

- [ ] **Step 3: Verify dimensions are exact**

```bash
for f in metadata/youtube-transcribe-*.png; do
  echo "$f: $(sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/{printf "%s ", $2}')"
done
```

Expected: every line reads `2000 1250`. Anything else fails Raycast validation.

- [ ] **Step 4: Look at all three**

Open each file and confirm one window is cleanly framed, centred, sharp, with no sliver of a neighbouring window at any edge. Screenshot 1 is the history list, 2 is the transcript detail, 3 is the AI summary.

If any is poorly framed, adjust that entry's `X` offset and rerun Step 2 for it. This is a judgment call no command can make.

- [ ] **Step 5: Repoint the README hero**

In `README.md`, replace line 9:

```markdown
![YouTube Transcribe Screenshot](./metadata/youtube-scribe-1.png)
```

with:

```markdown
![Transcript history on the left, the selected transcript with metadata and timestamped text in the middle, and its AI summary on the right](./media/youtube-transcribe-hero.png)
```

Descriptive alt text matches the convention in the published `raycast-publico` README and is what screen readers announce.

- [ ] **Step 6: Confirm no stale references and that metadata validation passes**

```bash
grep -rn "youtube-scribe-1.png" README.md docs/ context.md 2>/dev/null || echo "no stale image references"
npx ray lint 2>&1 | grep -i "image size" || echo "metadata validation passes"
```

Expected: `no stale image references`, then `metadata validation passes`.

The clone URL, `cd` line, and issues link in `README.md` still say `raycast-youtube-scribe`. That is correct and deliberate. Leave them.

- [ ] **Step 7: Commit**

```bash
git add metadata media README.md
git commit -F - <<'EOF'
fix: ship store screenshots at the required 2000x1250

The single metadata image was a 6200x1748 banner of three windows side by side.
Raycast requires exactly 2000x1250, so validation failed and publishing was
blocked.

Each window is now its own screenshot, cropped at 1943x1214 and scaled down, so
nothing is upscaled. The banner moves to media/ and stays the README hero, out
of the validator's path and out of assets/, which ships to every user.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: Add CI so this cannot rot again

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the `lint`, `test`, and `build` scripts already in `package.json`.
- Produces: nothing.

This is the task that addresses the actual root cause. Formatting and pinning treat the symptom; the reason lint was red for months is that nothing ever required it to pass.

- [ ] **Step 1: Confirm lint is fully green before adding a gate that enforces it**

```bash
npx ray lint; echo "exit: $?"
```

Expected: `exit: 0`. If it is non-zero, an earlier task is incomplete. Fix it first, so CI is green on its first run.

- [ ] **Step 2: Create the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

Adapted from `raycast-publico`'s workflow, with `npm run lint` added. That step is the one `publico` omits, and its absence here is why the formatting drifted unnoticed.

- [ ] **Step 3: Verify the workflow is valid YAML**

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/ci.yml','utf8');if(!/^name: CI/m.test(s)||!/npm run lint/.test(s))throw new Error('unexpected workflow content');console.log('workflow looks well formed')"
```

Expected: `workflow looks well formed`.

- [ ] **Step 4: Run locally exactly what CI will run**

```bash
npm run lint && npm test && npm run build && echo "CI steps pass locally"
```

Expected: `CI steps pass locally`. Running the real commands locally is the closest thing to proof before pushing.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -F - <<'EOF'
ci: run lint, tests, and build on push and pull request

Lint had been red for months because nothing required it to pass. Pinning
Prettier stops version drift but would not have caught this; only an
enforced check does.

Adapted from raycast-publico's workflow, plus the lint step that one omits.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Final Verification

- [ ] **Run the complete gate**

```bash
cd /Users/caraujo/Documents/raycast-youtube-transcribe
npx ray lint; echo "ray lint exit: $?"
npx tsc --noEmit && echo "tsc clean"
npx vitest run 2>&1 | tail -4
git status --short
```

Expected: `ray lint exit: 0`; `tsc clean`; `192 passed | 1 skipped`; clean working tree.

- [ ] **Confirm the commit sequence**

```bash
git log --oneline main..HEAD
```

Expected, oldest last: CI, screenshots, dead symbols, Default AI Action, blame-ignore plus context note, reformat, and the spec commit already on the branch.

- [ ] **Hand back to Carlos**

Do not merge or push. Report the state and let him decide, as with the previous branch.
