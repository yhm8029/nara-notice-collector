# Procurement Corp Resilient Collection and Export Design

## Goal

사업자 수집 중 나라장터 API가 `07 입력범위값 초과`를 반환한 월은 실패 목록에 기록하고 다음 월 수집을 계속한다. 저장된 사업자 목록은 CSV와 Excel 파일로 다운로드할 수 있게 하며, 파일 헤더는 모두 한글을 사용한다.

## Behavior

- 월별 사업자 수집 중 특정 월이 API 범위 오류로 실패하면 전체 작업을 중단하지 않는다.
- 실패한 월은 `from`, `to`, `error`를 상태 응답에 포함한다.
- 사용자는 수집 완료 후 실패 월 목록을 보고 나중에 같은 범위만 다시 수집할 수 있다.
- 사업자 목록 다운로드는 현재 DB에 저장된 전체 업체를 대상으로 한다.
- CSV/Excel 헤더는 `번호`, `사업자등록번호`, `업체명`, `대표자명`, `주소`, `상세주소`, `지역명`, `업종/업무구분`, `업종상세`, `전화번호`, `팩스번호`, `홈페이지주소`를 사용한다.

## Architecture

- `NaraProcurementCorpClient.collectAutoMonthly()`가 월 단위 실패를 `failedRanges`로 반환한다.
- 웹 서버의 백그라운드 수집 작업 상태에 실패 월 목록을 저장하고 `/api/procurement-corps/status`로 노출한다.
- `ProcurementCorpStore`는 전체 DB 행을 반환하는 메서드를 제공한다.
- 새 export 모듈이 사업자 행을 CSV와 Excel 버퍼로 변환한다.
- 웹 UI는 사업자 탭 상단에 CSV/Excel 다운로드 버튼과 실패 월 목록을 표시한다.

## Error Handling

- API resultCode `07`은 월별 수집에서 건너뛸 수 있는 입력 범위 오류로 취급한다.
- 그 외 API 오류는 기존처럼 수집 작업 오류로 기록한다.
- 실패 월이 있어도 저장된 결과와 상태는 유지한다.

## Testing

- 월별 수집이 `07` 오류 월을 실패 목록에 기록하고 다음 월을 계속 수집하는지 테스트한다.
- 백그라운드 수집 상태가 실패 월 목록을 반환하는지 테스트한다.
- 사업자 CSV/Excel 다운로드가 한글 헤더와 전체 DB 행을 포함하는지 테스트한다.
- 웹 UI에 사업자 다운로드 버튼과 실패 월 표시가 렌더링되는지 테스트한다.
