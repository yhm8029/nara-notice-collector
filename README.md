# nara-notice-collector

A beginner-friendly tool for collecting, classifying, and exporting Korean public procurement notices.

## Why this exists

Many small-business teams still check Nara procurement notices manually and organize the useful ones in spreadsheets. This project provides a small Node.js CLI that shows the basic automation flow without adding sales recommendation logic.

## Features

- Load dummy sample notices without an API key
- Normalize common Nara notice fields
- Classify notices as construction, goods, service, or unknown by simple title keywords
- Calculate D-Day from the bid deadline
- Export a fixed 10-column CSV or Excel file
- Provide a Nara API client structure for collect mode

## Requirements

- Node.js 20 or later
- npm

## Install

```bash
npm install
```

## Run sample data

Excel:

```bash
npm run sample -- --format xlsx --output ./output/sample-notices.xlsx
```

CSV:

```bash
npm run sample -- --format csv --output ./output/sample-notices.csv
```

After publishing, the CLI shape is:

```bash
npx nara-notice-collector sample --format xlsx --output ./output/sample-notices.xlsx
npx nara-notice-collector sample --format csv --output ./output/sample-notices.csv
```

## Collect from Nara API

Sample mode does not require an API key.

Collect mode requires:

```text
NARA_API_KEY=사용자_나라장터_API_키
```

Example:

```bash
npx nara-notice-collector collect \
  --from 2026-05-01 \
  --to 2026-05-31 \
  --keyword 자동제어 \
  --format xlsx \
  --output ./output/notices.xlsx
```

See [docs/nara-api-key-ko.md](docs/nara-api-key-ko.md) for the Korean setup guide.

## Output columns

The CSV and Excel output always uses these 10 columns in this order:

```text
D-Day
공고번호
공고명
구분
기관명
지역
예산
마감일
업종제한
원문링크
```

Sample outputs are included at:

- [examples/sample-output.csv](examples/sample-output.csv)
- [examples/sample-output.xlsx](examples/sample-output.xlsx)

## Classification rules

The first release uses simple title-keyword matching only.

- construction: 공사, 개축, 증축, 신축, 보수, 리모델링, 전기공사, 기계설비공사, 정보통신공사
- goods: 구매, 제조, 납품, 물품, 장비, 기자재, 자재, 시스템 구입
- service: 용역, 설계, 감리, 조사, 점검, 유지관리, 위탁, 진단, 컨설팅

Priority is construction, goods, service, then unknown.

## D-Day rules

- Deadline today: `D-Day`
- Deadline tomorrow: `D-1`
- Deadline seven days later: `D-7`
- Deadline yesterday: `D+1`
- Missing or invalid deadline: `확인필요`

Date calculations are performed by calendar day, not by hour.

## Development

```bash
npm run typecheck
npm test
```

## Documentation

- [Getting started in Korean](docs/getting-started-ko.md)
- [Nara API key setup in Korean](docs/nara-api-key-ko.md)
- [Notice field guide in Korean](docs/notice-fields-ko.md)

## Out of scope

This project focuses on public procurement notice collection, basic classification, D-Day calculation, and CSV/Excel export.

Advanced project identity resolution, related-notice matching, sales opportunity scoring, private customer workflows, and LLM-based business decision logic are intentionally out of scope.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
