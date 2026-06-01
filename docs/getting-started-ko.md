# 시작하기

이 문서는 Windows와 터미널 사용에 익숙하지 않은 사용자가 샘플 데이터를 Excel 또는 CSV로 출력하는 흐름을 설명합니다.

## 1. Node.js 설치

Node.js 20 이상을 설치합니다.

설치 후 PowerShell에서 버전을 확인합니다.

```powershell
node --version
npm --version
```

## 2. 코드 받기

```powershell
git clone https://github.com/yhm8029/nara-notice-collector.git
cd nara-notice-collector
```

## 3. 패키지 설치

```powershell
npm install
```

## 4. 샘플 Excel 만들기

API 키 없이 더미 공고로 실행할 수 있습니다.

```powershell
npm run sample -- --format xlsx --output ./output/sample-notices.xlsx
```

## 5. 로컬 웹 화면 실행

터미널 명령 대신 브라우저 화면에서 샘플 공고를 확인하고 파일을 내려받을 수 있습니다.

```powershell
npm run web
```

실행 후 브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:5173
```

각 공고의 `공고문` 버튼을 누르면 새 탭에서 공고문을 엽니다.
나라장터 API 응답에 G2B Synap 문서뷰어 URL이 있으면 그 URL을 바로 열고, 없으면 공고문 첨부파일 링크를 엽니다.

별도 Synap 문서뷰어 서버가 있는 환경에서는 실행 전에 아래 환경변수를 설정할 수 있습니다.

```powershell
$env:SYNAP_VIEWER_URL_TEMPLATE="https://viewer.example.com/view?url={url}&title={title}"
npm run web
```

`viewer.example.com` 부분은 실제 사용하는 Synap 문서뷰어 주소로 바꿔야 합니다.
설정하지 않으면 API 응답의 Synap viewer URL 또는 공고문 첨부파일 링크를 그대로 엽니다.

## 6. 샘플 CSV 만들기

```powershell
npm run sample -- --format csv --output ./output/sample-notices.csv
```

## 7. 결과 파일 확인

`output` 폴더에 파일이 생성됩니다.

- `sample-notices.xlsx`
- `sample-notices.csv`

Excel 파일은 첫 행이 고정되고, 필터와 기본 컬럼 폭이 적용됩니다.

## 자주 발생하는 오류

### `node` 명령을 찾을 수 없음

Node.js가 설치되지 않았거나 PATH가 적용되지 않은 상태입니다. Node.js를 설치한 뒤 PowerShell을 새로 엽니다.

### `npm install` 실패

인터넷 연결과 Node.js 버전을 확인합니다. Node.js 20 이상을 권장합니다.

### `NARA_API_KEY` 오류

`collect` 명령은 나라장터 API 키가 필요합니다. API 키가 없으면 `sample` 명령을 사용합니다.
