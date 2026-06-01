import { describe, expect, it } from "vitest";
import {
  EXPORT_COLUMNS,
  buildNoticeExportRows,
  exportNoticesToCsv
} from "../src/export/csv-exporter.js";
import type { NormalizedNotice } from "../src/nara/types.js";

describe("CSV exporter", () => {
  it("builds fixed-column export rows in the required order", () => {
    const rows = buildNoticeExportRows([
      notice({ dDay: "D-1", noticeId: "B", noticeType: "goods" })
    ]);

    expect(Object.keys(rows[0])).toEqual(EXPORT_COLUMNS);
    expect(rows[0]).toEqual({
      "D-Day": "D-1",
      "공고번호": "B",
      "공고명": "자동제어 장비 구매",
      "구분": "물품",
      "기관명": "OO시청",
      "지역": "서울특별시",
      "예산": 1000,
      "마감일": "2026-06-01T10:00:00",
      "업종제한": "",
      "원문링크": "https://example.com/B"
    });
  });

  it("sorts by D-Day urgency, type, and notice id with 확인필요 at the bottom", () => {
    const rows = buildNoticeExportRows([
      notice({ dDay: "확인필요", noticeId: "Z", noticeType: "service" }),
      notice({ dDay: "D-7", noticeId: "C", noticeType: "service" }),
      notice({ dDay: "D-1", noticeId: "B", noticeType: "goods" }),
      notice({ dDay: "D-Day", noticeId: "A", noticeType: "construction" })
    ]);

    expect(rows.map((row) => row["공고번호"])).toEqual(["A", "B", "C", "Z"]);
  });

  it("exports CSV with fixed headers and escaped values", () => {
    const csv = exportNoticesToCsv([
      notice({ title: "자동제어 장비, 구매", noticeId: "20260500002" })
    ]);

    expect(csv.split("\n")[0]).toBe(EXPORT_COLUMNS.join(","));
    expect(csv).toContain("\"자동제어 장비, 구매\"");
  });
});

function notice(overrides: Partial<NormalizedNotice> = {}): NormalizedNotice {
  const noticeId = overrides.noticeId ?? "A";
  return {
    dDay: "D-Day",
    noticeId,
    title: "자동제어 장비 구매",
    noticeType: "goods",
    agency: "OO시청",
    region: "서울특별시",
    budget: 1000,
    deadline: "2026-06-01T10:00:00",
    sourceUrl: `https://example.com/${noticeId}`,
    ...overrides
  };
}
