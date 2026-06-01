import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSheet } from "read-excel-file/node";
import { EXPORT_COLUMNS } from "../src/export/csv-exporter.js";
import { exportNoticesToExcel } from "../src/export/excel-exporter.js";
import type { NormalizedNotice } from "../src/nara/types.js";

describe("Excel exporter", () => {
  it("writes an XLSX file with the fixed header order", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nara-notice-collector-"));
    const output = join(dir, "notices.xlsx");

    try {
      await exportNoticesToExcel(
        [
          {
            noticeId: "20260500001",
            title: "OO초등학교 개축공사",
            noticeType: "construction",
            agency: "OO교육지원청",
            region: "서울특별시",
            budget: 1200000000,
            deadline: "2026-06-01 오전 10:00",
            industryRestriction: "건축공사업",
            sourceUrl: "https://example.com/notices/20260500001"
          } satisfies NormalizedNotice
        ],
        output
      );

      const rows = await readSheet(output, "notices");
      expect(rows[0]).toEqual(EXPORT_COLUMNS);
      expect(rows[1]?.slice(0, 4)).toEqual([1, "20260500001", "OO초등학교 개축공사", "공사"]);
      expect(rows[1]?.[6]).toBe(1200000000);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
