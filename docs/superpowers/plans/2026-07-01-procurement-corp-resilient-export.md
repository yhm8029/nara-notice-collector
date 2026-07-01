# Procurement Corp Resilient Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make procurement corporation collection skip and record failed months, then export stored corporation rows to CSV and Excel with Korean headers.

**Architecture:** Extend the procurement corporation client to return collection results containing rows and failed monthly ranges. Store failed ranges in the web job status. Add a dedicated corporation export module and expose `/api/procurement-corps/export`.

**Tech Stack:** TypeScript, Express, React, Vitest, write-excel-file.

---

### Task 1: Failed Monthly Ranges

**Files:**
- Modify: `src/nara/procurement-corp-client.ts`
- Test: `test/procurement-corp-client.test.ts`

- [ ] Add a failing test where one monthly API response returns resultCode `07` and the next month returns data.
- [ ] Run `npm test -- test/procurement-corp-client.test.ts` and confirm the test fails because no failed range is returned.
- [ ] Implement `ProcurementCorpCollectionResult` with `corporations` and `failedRanges`.
- [ ] Make `collectAutoMonthly()` continue after skippable monthly API errors and return failed ranges.
- [ ] Run `npm test -- test/procurement-corp-client.test.ts`.

### Task 2: Server Status and Retry Surface

**Files:**
- Modify: `src/web/server.ts`
- Test: `test/web-server.test.ts`

- [ ] Add a failing test that starts a background collection with one failed month and verifies `/api/procurement-corps/status` includes `failedRanges`.
- [ ] Run `npm test -- test/web-server.test.ts` and confirm the new assertion fails.
- [ ] Store failed ranges in `ProcurementCorpCollectionJob`.
- [ ] Return failed ranges from `toProcurementCorpCollectionStatus()`.
- [ ] Run `npm test -- test/web-server.test.ts`.

### Task 3: Corporation Export

**Files:**
- Create: `src/export/procurement-corp-exporter.ts`
- Modify: `src/nara/procurement-corp-store.ts`
- Modify: `src/web/server.ts`
- Test: `test/procurement-corp-exporter.test.ts`
- Test: `test/web-server.test.ts`

- [ ] Add failing CSV and Excel export tests with Korean headers.
- [ ] Add a failing server test for `/api/procurement-corps/export?format=csv`.
- [ ] Implement `listAllRows()` in `ProcurementCorpStore`.
- [ ] Implement corporation CSV and Excel buffer exporters.
- [ ] Add `/api/procurement-corps/export`.
- [ ] Run exporter and server tests.

### Task 4: Web UI

**Files:**
- Modify: `src/web/client/App.tsx`
- Test: `test/web-client.test.tsx`

- [ ] Add a failing render test for `CSV`, `Excel`, and failed month labels in the business tab.
- [ ] Add UI state for failed ranges.
- [ ] Add business CSV/Excel download buttons.
- [ ] Render failed month messages.
- [ ] Run `npm test -- test/web-client.test.tsx`.

### Task 5: Verification

**Files:**
- All touched files

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run web:build`.
- [ ] Restart local web server and verify `/api/procurement-corps/export?format=csv` returns a Korean header.
