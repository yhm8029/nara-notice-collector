# nara-notice-collector

A beginner-friendly tool for collecting, classifying, and exporting Korean public procurement notices.

## Purpose

This project helps small-business staff who currently review Nara procurement notices by hand and organize them in spreadsheets.

The tool focuses on:

- collecting public procurement notice data
- normalizing basic fields
- classifying notices as construction, goods, service, or unknown
- calculating D-Day from the bid deadline
- exporting a fixed CSV/Excel review table

## Requirements

- Node.js 20 or later
- npm

## Development

```bash
npm install
npm run typecheck
npm test
```

## Nara API key

Sample mode does not require an API key.

Collect mode requires:

```text
NARA_API_KEY=사용자_나라장터_API_키
```

See [docs/nara-api-key-ko.md](docs/nara-api-key-ko.md) for the Korean setup guide.

## Out of scope

This project focuses on public procurement notice collection, basic classification, D-Day calculation, and CSV/Excel export.

Advanced project identity resolution, related-notice matching, sales opportunity scoring, private customer workflows, and LLM-based business decision logic are intentionally out of scope.
