import { describe, expect, it } from "vitest";
import { loadSampleRawNotices } from "../src/nara/sample-client.js";
import type { NoticeExportRow, NormalizedNotice } from "../src/nara/types.js";

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
