# Command Argument Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `url` and `format` command arguments so transcript fetching is auto-detect-first with a manual video/language fallback form.

**Architecture:** Keep transcript fetching keyed by detected or manually entered video plus optional requested language. Treat format as a view concern only: the fetch path stores canonical transcript data, and detail openings default to text while history can still switch between text and JSON.

**Tech Stack:** Raycast API, TypeScript, Vitest

---

### Task 1: Lock the new command contract in tests

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/tests/command-metadata.test.ts`
- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/tests/launch-mode.test.ts`

- [ ] **Step 1: Write failing tests for a single optional `language` argument**
- [ ] **Step 2: Write failing tests showing language alone does not trigger auto-run**
- [ ] **Step 3: Run targeted tests and verify failure**

### Task 2: Remove `url` and `format` from the command manifest and launch-mode logic

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/package.json`
- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/src/lib/launch-mode.ts`
- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/tests/command-metadata.test.ts`
- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/tests/launch-mode.test.ts`

- [ ] **Step 1: Keep only `language` as an optional command argument**
- [ ] **Step 2: Make auto-run depend only on detected clipboard/tab sources**
- [ ] **Step 3: Keep manual fallback when no source is detected**

### Task 3: Simplify the fetch command form and defaults

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/src/get-youtube-transcript.tsx`

- [ ] **Step 1: Remove `url` and `format` from command arguments/defaults**
- [ ] **Step 2: Remove the output-format field from the manual form**
- [ ] **Step 3: Always fetch/store canonical transcript data and open detail in text mode**
- [ ] **Step 4: Keep manual fallback fields limited to video and language**

### Task 4: Verify the end-to-end behavior

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/README.md` if command usage text needs updating

- [ ] **Step 1: Run `npm test`**
- [ ] **Step 2: Run `npm run build`**
- [ ] **Step 3: Run `npm run lint`**
