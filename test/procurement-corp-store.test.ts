import { describe, expect, it } from "vitest";
import { ProcurementCorpStore } from "../src/nara/procurement-corp-store.js";
import type { RawProcurementCorp } from "../src/nara/procurement-corp-client.js";

describe("ProcurementCorpStore", () => {
  it("upserts corporations and returns indexed 20-row pages", () => {
    const store = new ProcurementCorpStore(":memory:");
    const corporations: RawProcurementCorp[] = Array.from({ length: 25 }, (_, index) => ({
      bizno: String(1000000000 + index),
      corpNm: `업체${index + 1}`,
      ceoNm: `대표${index + 1}`,
      adrs: "서울특별시 중구",
      dtlAdrs: `${index + 1}층`,
      rgnNm: "서울특별시 중구",
      corpBsnsDivNm: "물품",
      industryDetailSummary: index === 0 ? "software business(1426, normal)" : "",
      telNo: "02-0000-0000",
      faxNo: "",
      hmpgAdrs: ""
    }));

    store.upsertMany(corporations);

    const firstPage = store.listRows({ page: 1, pageSize: 20 });
    const secondPage = store.listRows({ page: 2, pageSize: 20 });

    expect(firstPage.totalCount).toBe(25);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.rows).toHaveLength(20);
    expect(firstPage.rows[0]?.["No."]).toBe(1);
    expect(firstPage.rows[19]?.["No."]).toBe(20);
    expect(secondPage.rows).toHaveLength(5);
    expect(secondPage.rows[0]?.["No."]).toBe(21);
    expect(secondPage.rows[0]?.["사업자등록번호"]).toBe("1000000020");
    expect(firstPage.rows[0]?.["업종상세"]).toBe("software business(1426, normal)");
  });

  it("finds a corporation by business number for notice winner enrichment", () => {
    const store = new ProcurementCorpStore(":memory:");
    store.upsertMany([
      {
        bizno: "1111111111",
        corpNm: "낙찰건설",
        telNo: "02-1111-1111"
      }
    ]);

    expect(store.findByBusinessNumber("111-11-11111")).toMatchObject({
      bizno: "1111111111",
      corpNm: "낙찰건설",
      telNo: "02-1111-1111"
    });
    expect(store.findByBusinessNumber("222-22-22222")).toBeUndefined();
  });
});
