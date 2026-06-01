# nara-notice-collector

나라장터 공고를 수집하고, 기본 정보를 정리한 뒤, 공사·물품·용역으로 간단 분류하여 CSV/Excel 파일로 내보내는 도구입니다.

이 프로젝트는 나라장터 공고를 매일 직접 검색하고, 필요한 내용을 엑셀에 수작업으로 옮기는 중소기업 실무자를 돕기 위해 만들었습니다.
API나 개발 경험이 많지 않은 사람도 샘플 데이터를 실행해보고, 점진적으로 나라장터 API 기반 자동화를 시작할 수 있도록 단순한 구조를 목표로 합니다.

---

## 왜 만들었나요?

많은 중소기업에서는 아직도 나라장터 공고를 사람이 직접 확인하고, 공고번호·공고명·기관명·마감일·예산·업종제한 같은 정보를 엑셀에 옮겨 정리합니다.

이 방식은 다음과 같은 문제가 있습니다.

* 공고를 하나씩 확인해야 해서 시간이 많이 걸림
* 반복 작업이 많아 실수가 생기기 쉬움
* 공사·물품·용역 구분을 매번 사람이 직접 확인해야 함
* 공고 데이터를 다시 활용하기 어려움

`nara-notice-collector`는 이런 반복 업무를 줄이기 위해 만든 초보자 친화형 공고 수집/정리 도구입니다.

초기 버전은 고급 추천 시스템이나 영업관리 시스템이 아니라, **공고를 가져오고, 기본 필드를 정리하고, 검토하기 쉬운 CSV/Excel 파일을 만드는 것**에 집중합니다.

---

## 주요 기능

현재 이 프로젝트가 목표로 하는 기능은 다음과 같습니다.

* 나라장터 공고 데이터 수집 구조 제공
* 샘플 공고 데이터 실행 지원
* 공고번호, 공고명, 기관명, 지역, 예산, 마감일, 업종제한 정리
* 나라장터 API 업무구분을 기준으로 공사·물품·용역·내자 기본 구분
* 실무 검토용 CSV 파일 생성
* 실무 검토용 Excel 파일 생성
* 초보자도 따라 할 수 있는 한국어 문서 제공

---

## 최종 출력 컬럼

CSV/Excel 파일은 아래 컬럼 순서로 생성됩니다.

| 컬럼 | 설명 |
| --- | --- |
| No. | 검토용 순번 |
| 공고번호 | 나라장터 공고번호 |
| 공고명 | 공고 제목 |
| 구분 | 공사 / 물품 / 용역 / 내자 |
| 기관명 | 공고기관명 |
| 지역 | 공고 지역 |
| 예산 | 추정가격 또는 예산, 천 단위 쉼표 표시 |
| 마감일 | 입찰 마감일 |
| 업종제한 | 업종제한 여부 또는 관련 정보 |
| 원문링크 | 공고 원문 URL |

---

## 사용 대상

이 도구는 특히 아래와 같은 사용자를 대상으로 합니다.

* 나라장터 공고를 매일 확인하는 중소기업 실무자
* 공공조달 입찰 정보를 엑셀로 정리하는 담당자
* API 사용 경험은 적지만 반복 업무를 자동화하고 싶은 사용자
* 개발자는 아니지만 간단한 명령어 실행으로 업무 시간을 줄이고 싶은 사용자
* 공고 데이터를 CSV/Excel 형태로 정리해 내부 검토 자료로 활용하고 싶은 사용자

---

## 설치 요구사항

아래 프로그램이 필요합니다.

* Node.js 20 이상
* npm

Node.js가 설치되어 있지 않다면 먼저 Node.js 공식 사이트에서 LTS 버전을 설치하세요.

---

## 개발 환경 실행

패키지를 설치합니다.

```bash
npm install
```

타입 검사를 실행합니다.

```bash
npm run typecheck
```

테스트를 실행합니다.

```bash
npm test
```

로컬 웹 UI를 실행합니다.

```bash
npm run web
```

---

## 샘플 데이터 실행

API 키가 없어도 샘플 데이터로 먼저 실행해볼 수 있습니다.

브라우저에서 실행:

```bash
npm run web
```

실행 후 아래 주소를 엽니다.

```text
http://127.0.0.1:5173
```

CSV 파일로 내보내기:

```bash
npm run sample -- --format csv --output ./output/sample-notices.csv
```

Excel 파일로 내보내기:

```bash
npm run sample -- --format xlsx --output ./output/sample-notices.xlsx
```

실행 후 `output` 폴더에서 생성된 파일을 확인할 수 있습니다.

---

## 나라장터 API 사용

실제 나라장터 공고를 수집하려면 공공데이터포털에서 나라장터 관련 API 활용 신청을 하고 API 키를 발급받아야 합니다.

환경변수 예시는 다음과 같습니다.

```bash
NARA_API_KEY=발급받은_API_키
```

API 키 설정 방법은 아래 문서에서 자세히 설명합니다.

```text
docs/nara-api-key-ko.md
```

---

## Synap 공고문 보기

로컬 웹 UI에서 각 공고의 `공고문` 버튼을 누르면 공고 원문을 새 탭으로 엽니다.

Synap 문서뷰어 서버를 사용하는 환경에서는 아래처럼 URL 템플릿을 설정할 수 있습니다.

```bash
SYNAP_VIEWER_URL_TEMPLATE="https://viewer.example.com/view?url={url}&title={title}"
```

`{url}`에는 공고 원문 URL이, `{title}`에는 공고명이 URL 인코딩되어 들어갑니다.
이 값이 설정되지 않으면 기존 `원문링크`를 그대로 엽니다.

실제 Synap 서버 주소와 파라미터 이름은 기관 또는 설치 환경에 맞게 설정해야 하며, 이 저장소에는 사설 Synap 주소나 인증 정보를 포함하지 않습니다.

---

## 공사·물품·용역·내자 분류 기준

현재 버전에서는 공고명 키워드가 아니라 나라장터 API의 업무구분 정보를 기준으로 분류합니다.

분류 우선순위는 다음과 같습니다.

1. API 응답의 `bsnsDivNm` 값
2. 업무별 API endpoint에서 부여한 내부 `noticeTypeHint`
3. 값이 없거나 알 수 없는 경우 `내자`

수집 client는 나라장터 입찰공고정보서비스의 업무별 조회 endpoint를 사용합니다.

- 공사: `getBidPblancListInfoCnstwkPPSSrch`
- 용역: `getBidPblancListInfoServcPPSSrch`
- 물품: `getBidPblancListInfoThngPPSSrch`
- 내자: 기타/외자 계열 응답을 포함해 내부 검토용 `내자` 라벨로 표시

이 API 필드와 endpoint 기준은 `yhm8029/notice-winner-pipeline-web` 저장소의 `input/review` 문서 중 `조달청_OpenAPI참고자료_나라장터_입찰공고정보서비스_1.1.docx` 및 변환된 `.txt` 내용을 참고했습니다.

참고 경로:

```text
https://github.com/yhm8029/notice-winner-pipeline-web/tree/main/input/review
```

이 분류는 API가 제공하는 업무구분을 실무 검토용 라벨로 옮긴 것이며, 법적 판단이나 최종 입찰 검토를 대체하지 않습니다.

---

## 프로젝트 범위

이 프로젝트는 나라장터 공고의 **수집, 기본 분류, 순번 부여, CSV/Excel 내보내기**에 집중합니다.

아래 기능은 의도적으로 포함하지 않습니다.

* 고도화된 프로젝트명 추출
* 연관공고 자동 매칭
* 공고 간 유사도 점수 계산
* 영업기회 추천
* 고객별 숨김/추천 정책
* 영업 담당자 배정, 메모, 진행상태 관리
* LLM 기반 판단 로직
* 내부 업무 시스템 전용 기능

이 프로젝트는 복잡한 영업관리 시스템이 아니라, 공공조달 공고 데이터를 처음 자동화하려는 사용자를 위한 기초 도구입니다.

## Out of scope

This project focuses on public procurement notice collection, basic classification, row numbering, and CSV/Excel export.

Advanced project identity resolution, related-notice matching, sales opportunity scoring, private customer workflows, and LLM-based business decision logic are intentionally out of scope.

---

## 개발 방향

초기 목표는 다음과 같습니다.

1. 샘플 데이터로 공고 정리 흐름을 확인할 수 있게 만들기
2. 나라장터 API 키를 연결해 실제 공고 수집 구조 제공
3. 공고를 공사·물품·용역·내자로 간단 구분
4. 검토하기 쉽도록 순번을 부여
5. 실무자가 바로 열어볼 수 있는 CSV/Excel 파일 생성
6. 초보자도 따라 할 수 있는 한국어 문서 제공

향후에는 사용자가 더 쉽게 실행할 수 있도록 Windows 실행 가이드, API 오류 해결 문서, Excel 출력 개선 등을 추가할 수 있습니다.

---

## 기여하기

이 프로젝트는 API와 자동화에 익숙하지 않은 실무자도 사용할 수 있는 단순한 도구를 목표로 합니다.

기여 시에는 아래 방향을 지켜주세요.

* 초보자가 이해하기 쉬운 코드와 문서 유지
* 실제 고객 데이터나 민감정보 포함 금지
* 나라장터 공고 수집·정리 범위에 집중
* 고급 영업기회 추천이나 내부 업무 시스템 기능은 제외
* 테스트 가능한 작은 단위로 기능 추가

자세한 내용은 `CONTRIBUTING.md`를 참고하세요.

---

## 라이선스

MIT License를 사용합니다.
