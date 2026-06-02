# Review Workflow PR Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stacked PR sequence that turns the local web UI into a review workspace and adds repository release-management hygiene.

**Architecture:** Existing web workspace behavior stays split between React UI (`src/web/client/App.tsx`) and pure helper logic (`src/web/client/notice-workspace.ts`). User-specific review metadata is kept client-side in localStorage so the tool remains local-only and does not need a database. Repository process features live under `.github`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, GitHub Actions, GitHub PRs.

---

### Task 0: Foundation PR

**Files:**
- Modify: `src/web/client/App.tsx`
- Modify: `src/web/client/styles.css`
- Create: `src/web/client/notice-workspace.ts`
- Test: `test/web-client.test.tsx`
- Test: `test/web-client-workspace.test.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/getting-started-ko.md`
- Create: `.github/workflows/release.yml`

- [ ] Verify existing workspace changes with `npm test`, `npm run typecheck`, and `npm run web:build`.
- [ ] Commit on `codex/workspace-foundation`.
- [ ] Push and open a PR against `main`.

### Task 1: Review Status

**Files:**
- Modify: `src/web/client/notice-workspace.ts`
- Modify: `src/web/client/App.tsx`
- Modify: `src/web/client/styles.css`
- Test: `test/web-client-workspace.test.ts`
- Test: `test/web-client.test.tsx`
- Modify: `CHANGELOG.md`

- [ ] Write failing tests for review statuses: `미검토`, `검토중`, `관심`, `제외`.
- [ ] Implement status labels, default status, status filtering, and status select UI.
- [ ] Verify with `npm test -- test/web-client-workspace.test.ts test/web-client.test.tsx`, `npm run typecheck`, and `npm run web:build`.
- [ ] Commit on `codex/review-status` and open a stacked PR against `codex/workspace-foundation`.

### Task 2: Notes And Tags

**Files:**
- Modify: `src/web/client/notice-workspace.ts`
- Modify: `src/web/client/App.tsx`
- Modify: `src/web/client/styles.css`
- Test: `test/web-client-workspace.test.ts`
- Test: `test/web-client.test.tsx`
- Modify: `CHANGELOG.md`

- [ ] Write failing tests for parsing comma-separated tags and serializing per-notice memo state.
- [ ] Add detail-panel note textarea, tag input, localStorage persistence helpers, and visible tag chips.
- [ ] Verify with targeted tests, typecheck, and web build.
- [ ] Commit on `codex/notice-notes-tags` and open a stacked PR against `codex/review-status`.

### Task 3: Deadline D-Day Badges

**Files:**
- Modify: `src/web/client/notice-workspace.ts`
- Modify: `src/web/client/App.tsx`
- Modify: `src/web/client/styles.css`
- Test: `test/web-client-workspace.test.ts`
- Test: `test/web-client.test.tsx`
- Modify: `CHANGELOG.md`

- [ ] Write failing tests for `D-3`, `오늘 마감`, `마감 지남`, and no-deadline labels.
- [ ] Add deadline badge helper and table/detail badge UI.
- [ ] Verify with targeted tests, typecheck, and web build.
- [ ] Commit on `codex/deadline-badges` and open a stacked PR against `codex/notice-notes-tags`.

### Task 4: Favorites

**Files:**
- Modify: `src/web/client/notice-workspace.ts`
- Modify: `src/web/client/App.tsx`
- Modify: `src/web/client/styles.css`
- Test: `test/web-client-workspace.test.ts`
- Test: `test/web-client.test.tsx`
- Modify: `CHANGELOG.md`

- [ ] Write failing tests for favorite filtering and favorite export selection.
- [ ] Add star toggle, favorites-only filter, and favorite-count status.
- [ ] Verify with targeted tests, typecheck, and web build.
- [ ] Commit on `codex/favorite-notices` and open a stacked PR against `codex/deadline-badges`.

### Task 5: PR And Issue Templates

**Files:**
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/ISSUE_TEMPLATE/feature.yml`
- Create: `.github/ISSUE_TEMPLATE/bug.yml`
- Modify: `CHANGELOG.md`

- [ ] Add templates for summary, verification, release impact, feature requests, and bugs.
- [ ] Verify with `npm test`, `npm run typecheck`, and `npm run web:build`.
- [ ] Commit on `codex/github-templates` and open a stacked PR against `codex/favorite-notices`.

### Task 6: Release Notes Template

**Files:**
- Create: `.github/release.yml`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] Add GitHub generated release notes grouping for features, fixes, docs, tests, CI, and dependencies.
- [ ] Document release labels in README.
- [ ] Verify with `npm test`, `npm run typecheck`, and `npm run web:build`.
- [ ] Commit on `codex/release-notes-template` and open a stacked PR against `codex/github-templates`.
