# Local Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Vite + React web UI that reuses the existing notice collection, normalization, D-Day, CSV, and Excel export logic.

**Architecture:** Add a small Express app in `src/web/server.ts` with JSON and file-download endpoints. Add Vite React files under `src/web/client` and serve them through Vite middleware for local development. Keep all business behavior in existing shared modules.

**Tech Stack:** Node.js 20+, TypeScript, Express, Vite, React, Vitest, Supertest, existing CSV/Excel exporters.

---

### Task 1: Local Web API

**Files:**
- Create: `src/web/server.ts`
- Create: `test/web-server.test.ts`
- Modify: `src/export/excel-exporter.ts`
- Modify: `package.json`

- [ ] Write failing Vitest/Supertest tests for sample notices, missing API key collect error, and CSV export.
- [ ] Add Express API endpoints that pass those tests.
- [ ] Add an Excel buffer export helper for download responses.
- [ ] Run `npm test -- --run test/web-server.test.ts`.

### Task 2: React Client

**Files:**
- Create: `index.html`
- Create: `src/web/client/main.tsx`
- Create: `src/web/client/App.tsx`
- Create: `src/web/client/styles.css`
- Modify: `package.json`
- Create: `vite.config.ts`

- [ ] Add a Vite React client with sample load, collect form, download buttons, status, errors, and fixed-column table.
- [ ] Add restrained operational styling suitable for spreadsheet review.
- [ ] Run `npm run web:build`.

### Task 3: Documentation and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/getting-started-ko.md`

- [ ] Document `npm run web` and the local URL.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run web:build`.
- [ ] Start the local server and verify `/api/sample-notices` responds.
