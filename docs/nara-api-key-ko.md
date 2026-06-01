# 나라장터 API 키 설정

이 문서는 `nara-notice-collector collect` 명령을 사용하기 위한 기본 설정 흐름을 설명합니다.

## 1. 공공데이터포털 가입

1. 공공데이터포털에 가입합니다.
2. 로그인 후 검색창에서 나라장터 입찰공고 관련 API를 찾습니다.
3. 활용 신청을 진행합니다.

## 2. API 키 확인

활용 신청이 승인되면 공공데이터포털 마이페이지에서 일반 인증키를 확인할 수 있습니다.
로컬 웹이나 PowerShell에는 일반 인증키(Decoding)를 넣는 것을 권장합니다. Encoding 키를 그대로 넣으면 요청 과정에서 중복 인코딩될 수 있습니다.

이 프로젝트는 환경변수 이름을 `NARA_API_KEY`로 사용합니다.

## 3. Windows PowerShell 설정 예시

현재 터미널에서만 사용할 때:

```powershell
$env:NARA_API_KEY="사용자_나라장터_API_키"
```

## 4. 실행 예시

```bash
npx nara-notice-collector collect \
  --from 2026-05-01 \
  --to 2026-05-31 \
  --keyword 행정복지센터 \
  --format xlsx \
  --output ./output/notices.xlsx
```

## 5. API endpoint

기본 client는 공공데이터포털 나라장터 입찰공고정보서비스의 업무별 조회 API를 호출합니다.

```text
https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoCnstwkPPSSrch
https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServcPPSSrch
https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoThngPPSSrch
https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoFrgcptPPSSrch
```

조회구분은 등록일시 기준 `inqryDiv=1`을 사용하고, 날짜는 `YYYYMMDDHHMM` 형식으로 보냅니다.
예를 들어 `2026-05-01`부터 `2026-05-31`까지 조회하면 `202605010000`부터 `202605312359`까지 요청합니다.

실제 공공데이터포털 서비스명과 endpoint는 신청한 API 상품에 따라 달라질 수 있으므로, 필요하면 `src/nara/client.ts`의 endpoint 설정을 조정합니다.

## 6. 주의사항

- CI에서는 실제 나라장터 API를 호출하지 않습니다.
- API 키가 없으면 `collect` 명령은 실패하고 `sample` 명령만 사용할 수 있습니다.
- 호출 제한, 승인 상태, endpoint 변경은 공공데이터포털 정책을 따릅니다.
