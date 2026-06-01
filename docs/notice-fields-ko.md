# 출력 필드 설명

최종 CSV/Excel 파일은 아래 9개 컬럼만 포함합니다.

## No.

검토용 순번입니다. 출력 정렬 후 1부터 차례대로 부여합니다.

## 공고번호

나라장터 원천 데이터의 `bidNtceNo` 값을 사용합니다.

## 공고명

나라장터 원천 데이터의 `bidNtceNm` 값을 사용합니다.

## 구분

나라장터 API의 업무구분 정보를 기준으로 분류한 값입니다.

- `공사`
- `물품`
- `용역`
- `내자`

우선 API 응답의 `bsnsDivNm` 값을 사용하고, 값이 없으면 업무별 API endpoint에서 부여한 내부 `noticeTypeHint`를 사용합니다.
공고명에 `공사`, `구매`, `용역` 같은 단어가 들어 있어도 그 단어만으로 분류하지 않습니다.

참고한 API 문서는 `yhm8029/notice-winner-pipeline-web` 저장소의 `input/review` 경로에 있는 `조달청_OpenAPI참고자료_나라장터_입찰공고정보서비스_1.1.docx` 및 변환 `.txt` 파일입니다.

## 기관명

나라장터 원천 데이터의 `ntceInsttNm` 값을 사용합니다.

## 예산

추정가격 또는 배정예산으로 볼 수 있는 금액 필드를 숫자로 변환합니다.

현재 구현은 `presmptPrce`를 우선 사용하고, 없으면 `asignBdgtAmt`를 사용합니다.
CSV와 웹 화면에는 `120,000,000`처럼 천 단위 쉼표를 붙여 표시합니다.

## 마감일

나라장터 원천 데이터의 `bidClseDt` 값을 한국 기준 표시 텍스트로 정규화합니다.
예를 들어 `2026-06-03 10:00:00`은 `2026-06-03 오전 10:00`으로 표시합니다.
시간대가 포함된 ISO 문자열은 Asia/Seoul 기준으로 변환합니다.

## 업종제한

가능한 경우 업종명, 지역제한명, 물품분류명, 입찰참가제한, 공동수급 지역제한을 함께 표시합니다.

물품분류 제한은 `dtilPrdctClsfcNoNm`, `dtilPrdctClsfcNo`, `prdctClsfcNoNm`, `prdctClsfcNo`, `purchsObjPrdctList` 값을 우선 사용합니다.
예를 들어 `물품분류: 자외-가시선분광광도계(4111540601)`처럼 표시합니다.

업종 제한명이 직접 내려오지 않는 용역/공사 공고는 `pubPrcrmntLrgClsfcNm`, `pubPrcrmntMidClsfcNm`, `pubPrcrmntClsfcNm`, `pubPrcrmntClsfcNo` 값을 사용해 `업종/분류: 기술용역 > 설계 > 건축설계용역(81101508)`처럼 표시합니다.
상세 필드가 전혀 없을 때만 `업종제한 있음` 또는 `물품분류제한 있음` 같은 확인용 문구를 사용합니다.

## 원문링크

원천 데이터의 `sourceUrl`, `bidNtceDtlUrl`, `bidNtceUrl` 중 확인 가능한 공고 상세 URL을 사용합니다.
로컬 웹의 `공고문` 버튼은 API 응답에 G2B Synap 문서뷰어 URL이 있으면 그 URL을 바로 열고, 없으면 `stdNtceDocUrl` 또는 `ntceSpecDocUrl1~10` 중 공고문 첨부파일 URL을 엽니다.
