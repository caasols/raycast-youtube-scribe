# History Retry Reuse Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse a single history row per `videoId + requestedLanguage`, including retries after failure, so transcript history stays canonical and duplicate rows are not created.

**Architecture:** Keep the existing `fetchKey` model as the canonical identity for transcript jobs. Extend history lookup to distinguish finished, active fetching, and retryable error rows, then update failed rows in place by reusing their existing `id` and moving them back to the top of history when retried.

**Tech Stack:** Raycast API, TypeScript, Vitest, LocalStorage-backed history store

---

### Task 1: Define canonical reuse behavior in tests

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/tests/history-logic.test.ts`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run `npm test -- tests/history-logic.test.ts` and verify the new expectations fail**
- [ ] **Step 3: Cover retryable error entries, active fetching reuse, and `auto` vs explicit language separation**

### Task 2: Teach history lookup about retryable failed entries

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/src/lib/history-logic.ts`
- Test: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/tests/history-logic.test.ts`

- [ ] **Step 1: Add a returned `retryable` entry for the latest failed match with the same fetch key**
- [ ] **Step 2: Preserve current behavior for finished and fresh in-flight entries**
- [ ] **Step 3: Keep `videoId + auto` separate from `videoId + <explicit language>`**

### Task 3: Reuse failed rows in place during queueing

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/src/get-youtube-transcript.tsx`
- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/src/history-store.ts`

- [ ] **Step 1: When `queueTranscriptJob` finds a retryable failed row, reuse its `id`**
- [ ] **Step 2: Reset that row to `fetching` instead of prepending a new row**
- [ ] **Step 3: Move the reused row to the top of history so the latest retry stays visible**
- [ ] **Step 4: Keep cached finished entries opening details and in-flight entries showing progress**

### Task 4: Verify the full behavior

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/tests/history-logic.test.ts`
- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/tests/fetch-navigation.test.ts` if needed

- [ ] **Step 1: Run targeted tests for history logic**
- [ ] **Step 2: Run `npm test`**
- [ ] **Step 3: Run `npm run build`**
- [ ] **Step 4: Run `npm run lint`**
