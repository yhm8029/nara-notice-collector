import { describe, expect, it } from "vitest";
import { loadSampleRawNotices } from "../src/nara/sample-client.js";
import type { NoticeExportRow, NormalizedNotice } from "../src/nara/types.js";
import {
  normalizeDate,
  normalizeMoney,
  normalizeText
} from "../src/normalize/field-normalizer.js";
import { normalizeNotice } from "../src/normalize/notice-normalizer.js";

describe("sample notice data", () => {
  it("loads at least 20 dummy raw notices", async () => {
    const notices = await loadSampleRawNotices();

    expect(notices.length).toBeGreaterThanOrEqual(20);
    expect(notices[0]).toMatchObject({
      bidNtceNo: expect.any(String),
      bidNtceNm: expect.any(String),
      ntceInsttNm: expect.any(String)
    });
  });

  it("defines the normalized notice and fixed export row contracts", () => {
    const notice: NormalizedNotice = {
      noticeId: "20260500001",
      title: "OO초등학교 그린스마트스쿨 개축공사",
      noticeType: "construction",
      agency: "OO교육지원청"
    };

    const row: NoticeExportRow = {
      "No.": 1,
      "공고번호": notice.noticeId,
      "공고명": notice.title,
      "구분": "공사",
      "기관명": notice.agency,
      "예산": "",
      "마감일": "",
      "업종제한": "",
      "원문링크": ""
    };

    expect(row).toEqual({
      "No.": 1,
      "공고번호": "20260500001",
      "공고명": "OO초등학교 그린스마트스쿨 개축공사",
      "구분": "공사",
      "기관명": "OO교육지원청",
      "예산": "",
      "마감일": "",
      "업종제한": "",
      "원문링크": ""
    });
  });
});

describe("field normalizer", () => {
  it("trims text and treats empty strings as undefined", () => {
    expect(normalizeText("  OO시청  ")).toBe("OO시청");
    expect(normalizeText("   ")).toBeUndefined();
    expect(normalizeText(undefined)).toBeUndefined();
  });

  it("converts money strings into numbers", () => {
    expect(normalizeMoney("1,200,000,000")).toBe(1200000000);
    expect(normalizeMoney(" 85000000 ")).toBe(85000000);
    expect(normalizeMoney("")).toBeUndefined();
    expect(normalizeMoney("금액미정")).toBeUndefined();
  });

  it("normalizes supported date strings into Korean KST display text", () => {
    expect(normalizeDate("2026-05-31 10:00:00")).toBe("2026-05-31 오전 10:00");
    expect(normalizeDate("2026-05-31 13:05:00")).toBe("2026-05-31 오후 1:05");
    expect(normalizeDate("2026-05-31T01:00:00Z")).toBe("2026-05-31 오전 10:00");
    expect(normalizeDate("2026-05-31")).toBe("2026-05-31");
    expect(normalizeDate("not a date")).toBeUndefined();
  });
});

describe("notice normalizer", () => {
  it("maps Nara raw fields into normalized notice fields", () => {
    const notice = normalizeNotice(
      {
        bidNtceNo: " 20260500001 ",
        bidNtceNm: " OO초등학교 그린스마트스쿨 개축공사 ",
        bsnsDivNm: "공사",
        ntceInsttNm: " OO교육지원청 ",
        presmptPrce: "1,200,000,000",
        bidClseDt: "2026-05-31 10:00:00",
        indstrytyLmtYn: "Y",
        indstrytyLmtNm: "건축공사업",
        indstrytyNm: "건축공사업",
        prtcptLmtRgnNm: "서울특별시",
        prdctClsfcLmtYn: "Y",
        dtilPrdctClsfcNo: "8110150801",
        dtilPrdctClsfcNoNm: "건축설계용역",
        regionNm: " 서울특별시 ",
        bidNtceDtlUrl: " https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=20260500001&bidPbancOrd=000 ",
        stdNtceDocUrl: " https://www.g2b.go.kr/download/std-notice.hwp "
      },
      { baseDate: new Date("2026-05-31") }
    );

    expect(notice).toMatchObject({
      noticeId: "20260500001",
      title: "OO초등학교 그린스마트스쿨 개축공사",
      agency: "OO교육지원청",
      region: "서울특별시",
      budget: 1200000000,
      deadline: "2026-05-31 오전 10:00",
      industryRestriction: "업종: 건축공사업, 지역: 서울특별시, 물품분류: 건축설계용역(8110150801)",
      sourceUrl: "https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo=20260500001&bidPbancOrd=000",
      documentUrl: "https://www.g2b.go.kr/download/std-notice.hwp",
      noticeType: "construction"
    });
    expect(notice.raw?.bidNtceNo).toBe(" 20260500001 ");
  });

  it("handles empty optional fields safely", () => {
    const notice = normalizeNotice({
      bidNtceNo: "20260500002",
      bidNtceNm: "행정복지센터 안내 장비 구매",
      ntceInsttNm: "OO시청",
      presmptPrce: "",
      bidClseDt: "",
      indstrytyLmtYn: "N",
      regionNm: ""
    });

    expect(notice.budget).toBeUndefined();
    expect(notice.deadline).toBeUndefined();
    expect(notice.region).toBeUndefined();
    expect(notice.industryRestriction).toBeUndefined();
  });

  it("uses the first notice document attachment when the standard notice URL is missing", () => {
    const notice = normalizeNotice({
      bidNtceNo: "20260500003",
      bidNtceNm: "행정복지센터 설계공모",
      ntceInsttNm: "OO시청",
      bidNtceUrl: "https://www.g2b.go.kr/link/detail",
      ntceSpecFileNm1: "설계공모지침서.hwp",
      ntceSpecDocUrl1: "https://www.g2b.go.kr/download/spec.hwp",
      ntceSpecFileNm2: "공고문.pdf",
      ntceSpecDocUrl2: "https://www.g2b.go.kr/download/notice.pdf"
    });

    expect(notice.sourceUrl).toBe("https://www.g2b.go.kr/link/detail");
    expect(notice.documentUrl).toBe("https://www.g2b.go.kr/download/notice.pdf");
  });

  it("shows concrete product classification limits instead of a generic product limit label", () => {
    const notice = normalizeNotice({
      bidNtceNo: "20260500004",
      bidNtceNm: "행정복지센터 장비 구매",
      ntceInsttNm: "OO시청",
      bsnsDivNm: "물품",
      prdctClsfcLmtYn: "Y",
      purchsObjPrdctList: "[1^4111540601^자외-가시선분광광도계],[2^4321150301^태블릿컴퓨터]"
    });

    expect(notice.industryRestriction).toBe(
      "물품분류: 자외-가시선분광광도계(4111540601), 태블릿컴퓨터(4321150301)"
    );
    expect(notice.industryRestriction).not.toContain("물품분류제한 있음");
  });

  it("shows procurement classification details when industry limit names are missing", () => {
    const notice = normalizeNotice({
      bidNtceNo: "20260500005",
      bidNtceNm: "행정복지센터 설계공모",
      ntceInsttNm: "OO시청",
      bsnsDivNm: "용역",
      indstrytyLmtYn: "Y",
      pubPrcrmntLrgClsfcNm: "기술용역",
      pubPrcrmntMidClsfcNm: "설계",
      pubPrcrmntClsfcNo: "81101508",
      pubPrcrmntClsfcNm: "건축설계용역"
    });

    expect(notice.industryRestriction).toBe("업종/분류: 기술용역 > 설계 > 건축설계용역(81101508)");
    expect(notice.industryRestriction).not.toContain("업종제한 있음");
  });

  it("prefers Nara Synap viewer URLs when the API response includes them", () => {
    const notice = normalizeNotice({
      bidNtceNo: "20260500006",
      bidNtceNm: "행정복지센터 설계공모",
      ntceInsttNm: "OO시청",
      stdNtceDocUrl: "https://www.g2b.go.kr/download/std-notice.hwp",
      stdNtceDocViewUrl:
        "https://www.g2b.go.kr/SynapDocViewServer/viewer/doc.html?key=3d3edcc457ef46d28e1077ee2076d23b&convType=img&convLocale=ko_KR&contextPath=/SynapDocViewServer"
    });

    expect(notice.documentUrl).toBe(
      "https://www.g2b.go.kr/SynapDocViewServer/viewer/doc.html?key=3d3edcc457ef46d28e1077ee2076d23b&convType=img&convLocale=ko_KR&contextPath=/SynapDocViewServer"
    );
  });
});
