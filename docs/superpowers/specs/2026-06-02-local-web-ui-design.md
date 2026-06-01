# Local Web UI Design

## Goal

Add a local-only browser UI for `nara-notice-collector` so non-developer users can load sample notices, review the fixed 10-column table, run API collection with a local API key, and download CSV or Excel files without memorizing CLI commands.

## Approach

Use Vite + React for the frontend and a small Express server for local API endpoints. The server runs on `127.0.0.1` and uses Vite middleware in development so `npm run web` starts one local URL. Existing domain logic stays in `src/normalize`, `src/classify`, `src/utils`, and `src/export`; the web layer only orchestrates these functions.

## Scope

Included:

- `npm run web` starts a local web server.
- Browser UI at `http://127.0.0.1:5173`.
- Sample notices load into a table with the existing 10 export columns.
- `from`, `to`, `keyword`, and API key fields support collect mode.
- CSV and Excel download buttons export the currently loaded rows.
- Missing API key and API failures show readable errors.
- Server tests cover sample, collect error, and CSV export endpoints.

Excluded:

- Hosted web deployment.
- Authentication or user accounts.
- Persisting API keys.
- Related notice matching, recommendation scoring, LLM logic, customer workflows, or sales workbench features.

## UI

The screen is an operational workspace, not a landing page. It has a compact top bar, a filter/action area, status counts, and a dense table. Controls use normal form inputs and icon buttons where useful. The table keeps the fixed columns: `No.`, `공고번호`, `공고명`, `구분`, `기관명`, `지역`, `예산`, `마감일`, `업종제한`, `원문링크`.

## Data Flow

1. `GET /api/sample-notices` loads sample raw notices, normalizes them, builds export rows, and returns JSON.
2. `POST /api/collect` accepts `from`, `to`, `keyword`, and optional `apiKey`, then calls `NaraApiClient`. If no key is provided and `NARA_API_KEY` is not set, it returns HTTP 400 with a readable error.
3. `POST /api/export` accepts normalized notices and `format=csv|xlsx`, then returns a downloadable file.

## Testing

Use Vitest and Supertest for local API behavior. Keep frontend build validation through `npm run web:build`. Existing `npm test`, `npm run typecheck`, and `npm run build` remain required.
