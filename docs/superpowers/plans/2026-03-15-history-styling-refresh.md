# History Styling Refresh Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `View Transcript History` and direct transcript details feel more polished and modern by adopting the transcript-first split-pane styling patterns from `raycast-publico`.

**Architecture:** Keep transcript preview as the primary content, but move structural context into `List.Item.Detail.Metadata` so the right pane feels designed instead of dumped. Use a shared detail-presentation helper so history detail and direct transcript detail render the same metadata stack and transcript body.

**Tech Stack:** Raycast API, TypeScript, Vitest

---

### Task 1: Define the shared detail presentation in tests

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/tests/history-detail.test.ts`

- [ ] **Step 1: Write failing tests for transcript-first markdown with cleaner section structure**
- [ ] **Step 2: Keep existing assertions around hiding debug logs on successful transcript views**
- [ ] **Step 3: Run targeted tests and verify failure**

### Task 2: Extract a detail presenter that separates markdown and metadata fields

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/src/lib/history-detail.ts`
- Test: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/tests/history-detail.test.ts`

- [ ] **Step 1: Keep transcript markdown focused on title plus transcript/error/processing body**
- [ ] **Step 2: Add a structured metadata payload helper for status, language, provider, segments, duration, saved time, and mode**
- [ ] **Step 3: Preserve debug information only for failed/in-progress states**

### Task 3: Refresh `View Transcript History`

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/src/transcript-history.tsx`

- [ ] **Step 1: Replace ad-hoc detail markdown usage with `List.Item.Detail` metadata blocks**
- [ ] **Step 2: Tighten left rows to reduce visual noise and improve scanability**
- [ ] **Step 3: Improve empty/loading copy to feel more intentional**
- [ ] **Step 4: Keep transcript preview as the dominant right-pane body**

### Task 4: Refresh direct transcript detail

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/src/get-youtube-transcript.tsx`

- [ ] **Step 1: Reuse the shared detail presenter for direct transcript openings**
- [ ] **Step 2: Keep text/json actions and history navigation, but align action order and metadata framing with history**
- [ ] **Step 3: Preserve transcript-first emphasis**

### Task 5: Verify the styling pass

**Files:**

- Modify: tests only if UI-facing copy changes need updates

- [ ] **Step 1: Run targeted detail tests**
- [ ] **Step 2: Run `npm test`**
- [ ] **Step 3: Run `npm run build`**
- [ ] **Step 4: Run `npm run lint`**
