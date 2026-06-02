# Changelog

## Unreleased

### Added

- Local web workspace controls for search presets, notice type filtering, sorting, selected export, and notice detail review
- Notice review statuses for 미검토, 검토중, 관심, and 제외
- Per-notice review memo and tag fields with local browser persistence
- Deadline D-day badges for upcoming, same-day, overdue, and missing deadlines
- Favorite notice toggles with favorites-only filtering and favorite-based export behavior
- Pull request and issue templates for feature requests, bug reports, verification, and release impact
- Generated release notes template with label-based changelog sections
- Release workflow that validates tagged releases, builds the web UI, packages the npm tarball, and publishes a GitHub release
- Local web UI notice document button with configurable Synap viewer URL template
- API business-division based notice type classification using Nara bid notice endpoints

### Changed

- Renamed the local web UI to `나라장터 공고 컬렉터`
- Clarified table action labels from source-link wording to `공고문 페이지` and `공고문 보기`

- Removed title keyword based notice type classification

## v0.3.0

Release focused on practical Excel/CSV review output for Nara procurement notices.

### Added

- Sequential `No.` column for review output
- Fixed 10-column CSV/Excel export format
- Korean display labels for notice type
- Excel output with header, filter, column width, and budget number-format settings
- Sample CSV and XLSX outputs
- Beginner-friendly Korean documentation
- Nara API key setup guide

### Output columns

- No.
- 공고번호
- 공고명
- 구분
- 기관명
- 지역
- 예산
- 마감일
- 업종제한
- 원문링크

### Notes

This release focuses on notice collection, basic classification, row numbering, and export.
Advanced project matching, related-notice matching, or sales opportunity scoring is not included.

## v0.2.0

### Added

- Nara API client structure
- `NARA_API_KEY` environment variable handling
- Search date and keyword options for collect mode
- Mock-based API client tests
- Korean Nara API key setup documentation

## v0.1.0

### Added

- Node.js 20+ TypeScript project scaffold
- Dummy sample notice data
- Normalized notice types
- Field normalization
- Basic construction/goods/service/domestic classification
- CSV export
- Excel export
- Basic CLI
- Test setup with Vitest
