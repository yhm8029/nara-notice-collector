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
      dDay: "D-1",
      noticeId: "20260500001",
      title: "OO초등학교 그린스마트스쿨 개축공사",
      noticeType: "construction",
      agency: "OO교육지원청"
    };

    const row: NoticeExportRow = {
      "D-Day": notice.dDay,
      "공고번호": notice.noticeId,
      "공고명": notice.title,
      "구분": "공사",
      "기관명": notice.agency,
      "지역": "",
      "예산": "",
      "마감일": "",
      "업종제한": "",
      "원문링크": ""
    };

    expect(row).toEqual({
      "D-Day": "D-1",
      "공고번호": "20260500001",
      "공고명": "OO초등학교 그린스마트스쿨 개축공사",
      "구분": "공사",
      "기관명": "OO교육지원청",
      "지역": "",
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

  it("normalizes supported date strings into ISO-like text", () => {
    expect(normalizeDate("2026-05-31 10:00:00")).toBe("2026-05-31T10:00:00");
    expect(normalizeDate("2026-05-31")).toBe("2026-05-31");
    expect(normalizeDate("not a date")).toBeUndefined();
  });
});

describe("notice normalizer", () => {
  it("maps Nara raw fields into normalized notice fields", () => {
    const notice = normalizeNotice({
      bidNtceNo: " 20260500001 ",
      bidNtceNm: " OO초등학교 그린스마트스쿨 개축공사 ",
      ntceInsttNm: " OO교육지원청 ",
      presmptPrce: "1,200,000,000",
      bidClseDt: "2026-05-31 10:00:00",
      indstrytyLmtYn: "Y",
      indstrytyLmtNm: "건축공사업",
      regionNm: " 서울특별시 ",
      sourceUrl: " https://example.com/notices/20260500001 "
    });

    expect(notice).toMatchObject({
      noticeId: "20260500001",
      title: "OO초등학교 그린스마트스쿨 개축공사",
      agency: "OO교육지원청",
      region: "서울특별시",
      budget: 1200000000,
      deadline: "2026-05-31T10:00:00",
      industryRestriction: "건축공사업",
      sourceUrl: "https://example.com/notices/20260500001",
      dDay: "확인필요",
      noticeType: "construction"
    });
    expect(notice.raw?.bidNtceNo).toBe(" 20260500001 ");
  });

  it("handles empty optional fields safely", () => {
    const notice = normalizeNotice({
      bidNtceNo: "20260500002",
      bidNtceNm: "자동제어 장비 구매",
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
});
