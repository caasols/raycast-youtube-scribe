# Per-FetchKey View Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remember transcript text/json view choice per `fetchKey`, while defaulting every transcript to text until the user changes that specific transcript.

**Architecture:** Replace the current global history view-mode preference with a per-`fetchKey` preference map stored in `LocalStorage`. Both transcript entry points, history detail and direct transcript detail, will resolve and persist mode through the same helper so a user’s choice follows that exact transcript variant.

**Tech Stack:** Raycast API, TypeScript, Vitest, LocalStorage

---

### Task 1: Define preference behavior in tests

**Files:**

- Create: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/tests/view-mode-preferences.test.ts`

- [ ] **Step 1: Write failing tests for default text behavior**
- [ ] **Step 2: Write failing tests for per-fetchKey persistence**
- [ ] **Step 3: Write failing tests showing `abc::auto` and `abc::en` do not share preferences**

### Task 2: Add a shared per-fetchKey preference helper

**Files:**

- Create: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/src/lib/view-mode-preferences.ts`
- Test: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/tests/view-mode-preferences.test.ts`

- [ ] **Step 1: Add pure helpers for resolving and updating a view-mode map**
- [ ] **Step 2: Add `LocalStorage` wrappers around that map**
- [ ] **Step 3: Keep fallback mode hard-coded to `text`**

### Task 3: Wire history detail to per-fetchKey persistence

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/src/transcript-history.tsx`

- [ ] **Step 1: Remove the global `VIEW_MODE_KEY` usage**
- [ ] **Step 2: Resolve mode from the focused entry’s `fetchKey`**
- [ ] **Step 3: Persist updates for only that `fetchKey` when the user switches modes**

### Task 4: Wire direct transcript detail to the same preference

**Files:**

- Modify: `/Users/caraujo/My Drive/PERSONAL_PROJECTS/raycast-youtube-scribe/src/get-youtube-transcript.tsx`

- [ ] **Step 1: Resolve the saved mode for the current detail entry by `fetchKey`**
- [ ] **Step 2: Add text/json switch actions there if needed so the preference can be changed from the direct detail view**
- [ ] **Step 3: Default to `text` when no preference exists**

### Task 5: Verify the end-to-end behavior

**Files:**

- Modify: relevant tests if any UI-facing copy changes are needed

- [ ] **Step 1: Run targeted preference tests**
- [ ] **Step 2: Run `npm test`**
- [ ] **Step 3: Run `npm run build`**
- [ ] **Step 4: Run `npm run lint`**
