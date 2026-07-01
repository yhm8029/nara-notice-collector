import { describe, expect, it } from "vitest";
import {
  PROCUREMENT_CORP_EXPORT_COLUMNS,
  buildProcurementCorpExportRows,
  exportProcurementCorpsToCsv,
  exportProcurementCorpsToExcelBuffer
} from "../src/export/procurement-corp-exporter.js";

describe("procurement corporation exporter", () => {
  it("builds Korean-header export rows for procurement corporations", () => {
    const rows = buildProcurementCorpExportRows([
      {
        "No.": 3,
        "사업자등록번호": "1111111111",
        "업체명": "낙찰건설",
        "대표자명": "대표일",
        "주소": "서울특별시 중구",
        "상세주소": "1층",
        "지역명": "서울특별시 중구",
        "업종/업무구분": "공사",
        "업종상세": "건축공사업",
        "전화번호": "02-1111-1111",
        "팩스번호": "02-1111-1112",
        "홈페이지주소": "winner.example.com"
      }
    ]);

    expect(Object.keys(rows[0] ?? {})).toEqual(PROCUREMENT_CORP_EXPORT_COLUMNS);
    expect(rows[0]).toEqual({
      "번호": 1,
      "사업자등록번호": "1111111111",
      "업체명": "낙찰건설",
      "대표자명": "대표일",
      "주소": "서울특별시 중구",
      "상세주소": "1층",
      "지역명": "서울특별시 중구",
      "업종/업무구분": "공사",
      "업종상세": "건축공사업",
      "전화번호": "02-1111-1111",
      "팩스번호": "02-1111-1112",
      "홈페이지주소": "winner.example.com"
    });
  });

  it("exports procurement corporations to CSV with Korean headers", () => {
    const csv = exportProcurementCorpsToCsv([
      {
        "No.": 1,
        "사업자등록번호": "1111111111",
        "업체명": "낙찰건설, 주식회사",
        "대표자명": "대표일",
        "주소": "서울특별시 중구",
        "상세주소": "1층",
        "지역명": "서울특별시 중구",
        "업종/업무구분": "공사",
        "업종상세": "건축공사업",
        "전화번호": "02-1111-1111",
        "팩스번호": "",
        "홈페이지주소": ""
      }
    ]);

    expect(csv.split("\n")[0]).toBe(PROCUREMENT_CORP_EXPORT_COLUMNS.join(","));
    expect(csv).toContain("\"낙찰건설, 주식회사\"");
  });

  it("exports procurement corporations to an Excel buffer", async () => {
    const buffer = await exportProcurementCorpsToExcelBuffer([
      {
        "No.": 1,
        "사업자등록번호": "1111111111",
        "업체명": "낙찰건설",
        "대표자명": "대표일",
        "주소": "서울특별시 중구",
        "상세주소": "1층",
        "지역명": "서울특별시 중구",
        "업종/업무구분": "공사",
        "업종상세": "건축공사업",
        "전화번호": "02-1111-1111",
        "팩스번호": "",
        "홈페이지주소": ""
      }
    ]);

    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
