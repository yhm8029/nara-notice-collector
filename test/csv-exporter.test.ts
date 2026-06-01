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
      notice({ noticeId: "B", noticeType: "goods" })
    ]);

    expect(Object.keys(rows[0])).toEqual(EXPORT_COLUMNS);
    expect(rows[0]).toEqual({
      "No.": 1,
      "공고번호": "B",
      "공고명": "행정복지센터 안내 장비 구매",
      "구분": "물품",
      "기관명": "OO시청",
      "예산": "1,000",
      "마감일": "2026-06-01 오전 10:00",
      "업종제한": "",
      "원문링크": "https://example.com/B"
    });
  });

  it("sorts by notice id and numbers rows from 1", () => {
    const rows = buildNoticeExportRows([
      notice({ noticeId: "Z", noticeType: "service" }),
      notice({ noticeId: "C", noticeType: "service" }),
      notice({ noticeId: "B", noticeType: "goods" }),
      notice({ noticeId: "A", noticeType: "construction" })
    ]);

    expect(rows.map((row) => row["공고번호"])).toEqual(["A", "B", "C", "Z"]);
    expect(rows.map((row) => row["No."])).toEqual([1, 2, 3, 4]);
  });

  it("exports CSV with fixed headers and escaped values", () => {
    const csv = exportNoticesToCsv([
      notice({ title: "행정복지센터 안내 장비, 구매", noticeId: "20260500002", budget: 120000000 })
    ]);

    expect(csv.split("\n")[0]).toBe(EXPORT_COLUMNS.join(","));
    expect(csv).toContain("\"행정복지센터 안내 장비, 구매\"");
    expect(csv).toContain("\"120,000,000\"");
  });
});

function notice(overrides: Partial<NormalizedNotice> = {}): NormalizedNotice {
  const noticeId = overrides.noticeId ?? "A";
  return {
    noticeId,
    title: "행정복지센터 안내 장비 구매",
    noticeType: "goods",
    agency: "OO시청",
    budget: 1000,
    deadline: "2026-06-01 오전 10:00",
    sourceUrl: `https://example.com/${noticeId}`,
    ...overrides
  };
}
