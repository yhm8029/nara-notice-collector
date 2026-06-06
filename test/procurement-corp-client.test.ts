import { describe, expect, it } from "vitest";
import {
  buildMonthlyCorpCollectionBatches,
  NaraProcurementCorpClient,
  createProcurementCorpClientFromEnv,
  toProcurementCorpRows,
  summarizeProcurementCorp
} from "../src/nara/procurement-corp-client.js";

describe("NaraProcurementCorpClient", () => {
  it("builds a business-number lookup request against the procurement corporation endpoint", async () => {
    const requestedUrls: string[] = [];
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      fetch: async (url) => {
        requestedUrls.push(String(url));
        return new Response(
          JSON.stringify({
            response: {
              body: {
                items: {
                  item: [
                    {
                      ceoNm: "홍길동",
                      corpNm: "테스트회사",
                      bizno: "1234567890",
                      telNo: "02-1234-5678"
                    }
                  ]
                }
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const result = await client.findByBusinessNumber("123-45-67890");

    expect(result).toEqual([
      {
        representativeName: "홍길동",
        companyName: "테스트회사",
        businessNumber: "1234567890",
        phoneNumber: "02-1234-5678",
        raw: {
          ceoNm: "홍길동",
          corpNm: "테스트회사",
          bizno: "1234567890",
          telNo: "02-1234-5678"
        }
      }
    ]);
    expect(requestedUrls).toHaveLength(1);

    const url = new URL(requestedUrls[0] ?? "");
    expect(url.origin + url.pathname).toBe(
      "https://apis.data.go.kr/1230000/ao/UsrInfoService02/getPrcrmntCorpBasicInfo02"
    );
    expect(url.searchParams.get("serviceKey")).toBe("sample-key");
    expect(url.searchParams.get("type")).toBe("json");
    expect(url.searchParams.get("pageNo")).toBe("1");
    expect(url.searchParams.get("numOfRows")).toBe("10");
    expect(url.searchParams.get("inqryDiv")).toBe("3");
    expect(url.searchParams.get("bizno")).toBe("1234567890");
  });

  it("summarizes whether the requested fields are present in a returned corporation item", () => {
    expect(
      summarizeProcurementCorp({
        ceoNm: "홍길동",
        corpNm: "테스트회사",
        bizno: "1234567890",
        telNo: "02-1234-5678"
      })
    ).toEqual({
      representativeName: { apiField: "ceoNm", value: "홍길동", present: true },
      companyName: { apiField: "corpNm", value: "테스트회사", present: true },
      businessNumber: { apiField: "bizno", value: "1234567890", present: true },
      phoneNumber: { apiField: "telNo", value: "02-1234-5678", present: true }
    });
  });

  it("collects procurement corporations by date range across all reported pages", async () => {
    const requestedUrls: string[] = [];
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      fetch: async (url) => {
        requestedUrls.push(String(url));
        const pageNo = new URL(String(url)).searchParams.get("pageNo");
        const item =
          pageNo === "1"
            ? [
                {
                  bizno: "1111111111",
                  corpNm: "첫번째회사",
                  ceoNm: "대표일",
                  adrs: "서울특별시 중구",
                  dtlAdrs: "1층",
                  rgnNm: "서울특별시 중구",
                  corpBsnsDivNm: "물품",
                  telNo: "02-1111-1111",
                  faxNo: "02-1111-1112",
                  hmpgAdrs: "first.example.com"
                },
                {
                  bizno: "2222222222",
                  corpNm: "두번째회사",
                  ceoNm: "대표이"
                }
              ]
            : [
                {
                  bizno: "3333333333",
                  corpNm: "세번째회사",
                  ceoNm: "대표삼"
                }
              ];

        return new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00", resultMsg: "정상" },
              body: {
                pageNo,
                numOfRows: 2,
                totalCount: 3,
                items: { item }
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const corporations = await client.collectByDateRange({
      from: "2026-06-01",
      to: "2026-06-05",
      numOfRows: 2
    });

    expect(corporations.map((corp) => corp.bizno)).toEqual(["1111111111", "2222222222", "3333333333"]);
    expect(requestedUrls.map((url) => new URL(url).searchParams.get("pageNo"))).toEqual(["1", "2"]);
    expect(new URL(requestedUrls[0] ?? "").searchParams.get("inqryDiv")).toBe("2");
    expect(new URL(requestedUrls[0] ?? "").searchParams.get("inqryBgnDt")).toBe("202606010000");
    expect(new URL(requestedUrls[0] ?? "").searchParams.get("inqryEndDt")).toBe("202606052359");
  });

  it("retries rate-limited corporation requests before failing the collection", async () => {
    let attempts = 0;
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      retryDelaysMs: [0],
      requestDelayMs: 0,
      fetch: async () => {
        attempts += 1;
        if (attempts === 1) {
          return new Response("too many requests", { status: 429, statusText: "Too Many Requests" });
        }

        return new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00", resultMsg: "정상" },
              body: {
                pageNo: 1,
                numOfRows: 100,
                totalCount: 1,
                items: {
                  item: [{ bizno: "1111111111", corpNm: "재시도회사" }]
                }
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const corporations = await client.collectByDateRange({
      from: "2026-06-01",
      to: "2026-06-30"
    });

    expect(attempts).toBe(2);
    expect(corporations[0]?.corpNm).toBe("재시도회사");
  });

  it("maps corporation API items to the business lookup table columns", () => {
    expect(
      toProcurementCorpRows([
        {
          bizno: "1111111111",
          corpNm: "첫번째회사",
          ceoNm: "대표일",
          adrs: "서울특별시 중구",
          dtlAdrs: "1층",
          rgnNm: "서울특별시 중구",
          corpBsnsDivNm: "물품",
          telNo: "02-1111-1111",
          faxNo: "02-1111-1112",
          hmpgAdrs: "first.example.com"
        }
      ])
    ).toEqual([
      {
        "No.": 1,
        "사업자등록번호": "1111111111",
        "업체명": "첫번째회사",
        "대표자명": "대표일",
        "주소": "서울특별시 중구",
        "상세주소": "1층",
        "지역명": "서울특별시 중구",
        "업종/업무구분": "물품",
        "업종상세": "",
        "전화번호": "02-1111-1111",
        "팩스번호": "02-1111-1112",
        "홈페이지주소": "first.example.com"
      }
    ]);
  });

  it("collects industry details for a procurement corporation by business number", async () => {
    const requestedUrls: string[] = [];
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      requestDelayMs: 0,
      fetch: async (url) => {
        requestedUrls.push(String(url));
        return new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00", resultMsg: "normal" },
              body: {
                pageNo: 1,
                numOfRows: 10,
                totalCount: 2,
                items: {
                  item: [
                    {
                      bizno: "1111111111",
                      indstrytyCd: "0036",
                      indstrytyNm: "information communication construction",
                      rgstDt: "2020-01-01 00:00:00",
                      vldPrdExprtDt: "",
                      indstrytyStatsNm: "",
                      rprsntIndstrytyYn: "Y"
                    },
                    {
                      bizno: "1111111111",
                      indstrytyCd: "1426",
                      indstrytyNm: "software business",
                      rgstDt: "2026-03-05 00:00:00",
                      vldPrdExprtDt: "2099-12-31 00:00:00",
                      indstrytyStatsNm: "normal",
                      rprsntIndstrytyYn: "N"
                    }
                  ]
                }
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const industries = await client.collectIndustryDetailsByBusinessNumber("111-11-11111");

    expect(industries).toEqual([
      {
        bizno: "1111111111",
        indstrytyCd: "0036",
        indstrytyNm: "information communication construction",
        rgstDt: "2020-01-01 00:00:00",
        vldPrdExprtDt: "",
        indstrytyStatsNm: "",
        rprsntIndstrytyYn: "Y"
      },
      {
        bizno: "1111111111",
        indstrytyCd: "1426",
        indstrytyNm: "software business",
        rgstDt: "2026-03-05 00:00:00",
        vldPrdExprtDt: "2099-12-31 00:00:00",
        indstrytyStatsNm: "normal",
        rprsntIndstrytyYn: "N"
      }
    ]);
    const url = new URL(requestedUrls[0] ?? "");
    expect(url.origin + url.pathname).toBe(
      "https://apis.data.go.kr/1230000/ao/UsrInfoService02/getPrcrmntCorpIndstrytyInfo02"
    );
    expect(url.searchParams.get("inqryDiv")).toBe("1");
    expect(url.searchParams.get("bizno")).toBe("1111111111");
  });

  it("skips industry detail lookup for non-standard business numbers", async () => {
    const requestedUrls: string[] = [];
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      requestDelayMs: 0,
      fetch: async (url) => {
        requestedUrls.push(String(url));
        throw new Error("invalid business numbers should not be requested");
      }
    });

    await expect(client.collectIndustryDetailsByBusinessNumber("000000742")).resolves.toEqual([]);

    const [corporation] = await client.enrichCorporationsWithIndustryDetails([
      {
        bizno: "000000742",
        corpNm: "foreign corporation"
      }
    ]);

    expect(corporation?.industryDetailSummary).toBe("");
    expect(requestedUrls).toEqual([]);
  });

  it("collects industry details across all reported pages", async () => {
    const requestedUrls: string[] = [];
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      requestDelayMs: 0,
      fetch: async (url) => {
        requestedUrls.push(String(url));
        const pageNo = new URL(String(url)).searchParams.get("pageNo");
        return new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00", resultMsg: "normal" },
              body: {
                pageNo,
                numOfRows: 1,
                totalCount: 2,
                items: {
                  item: [
                    pageNo === "1"
                      ? { bizno: "1111111111", indstrytyCd: "0036", indstrytyNm: "first industry" }
                      : { bizno: "1111111111", indstrytyCd: "1426", indstrytyNm: "second industry" }
                  ]
                }
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const industries = await client.collectIndustryDetailsByBusinessNumber("1111111111", { numOfRows: 1 });

    expect(industries.map((industry) => industry.indstrytyNm)).toEqual(["first industry", "second industry"]);
    expect(requestedUrls.map((url) => new URL(url).searchParams.get("pageNo"))).toEqual(["1", "2"]);
  });

  it("adds a readable industry detail summary to corporation rows", async () => {
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      requestDelayMs: 0,
      fetch: async () =>
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00", resultMsg: "normal" },
              body: {
                pageNo: 1,
                numOfRows: 10,
                totalCount: 2,
                items: {
                  item: [
                    {
                      bizno: "1111111111",
                      indstrytyCd: "0036",
                      indstrytyNm: "information communication construction",
                      indstrytyStatsNm: "",
                      rprsntIndstrytyYn: "Y"
                    },
                    {
                      bizno: "1111111111",
                      indstrytyCd: "1426",
                      indstrytyNm: "software business",
                      indstrytyStatsNm: "normal",
                      rprsntIndstrytyYn: "N"
                    }
                  ]
                }
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    });

    const [corporation] = await client.enrichCorporationsWithIndustryDetails([
      {
        bizno: "1111111111",
        corpNm: "first corporation"
      }
    ]);

    expect(corporation?.industryDetailSummary).toBe(
      "information communication construction(0036, 대표); software business(1426, normal)"
    );
    expect(toProcurementCorpRows([corporation ?? {}])[0]?.["업종상세"]).toBe(
      "information communication construction(0036, 대표); software business(1426, normal)"
    );
  });

  it("builds 10-month collection batches for concurrent workers", () => {
    expect(
      buildMonthlyCorpCollectionBatches({
        from: "2025-01-01",
        to: "2026-02-15",
        monthsPerBatch: 10
      })
    ).toEqual([
      [
        { from: "2025-01-01", to: "2025-01-31" },
        { from: "2025-02-01", to: "2025-02-28" },
        { from: "2025-03-01", to: "2025-03-31" },
        { from: "2025-04-01", to: "2025-04-30" },
        { from: "2025-05-01", to: "2025-05-31" },
        { from: "2025-06-01", to: "2025-06-30" },
        { from: "2025-07-01", to: "2025-07-31" },
        { from: "2025-08-01", to: "2025-08-31" },
        { from: "2025-09-01", to: "2025-09-30" },
        { from: "2025-10-01", to: "2025-10-31" }
      ],
      [
        { from: "2025-11-01", to: "2025-11-30" },
        { from: "2025-12-01", to: "2025-12-31" },
        { from: "2026-01-01", to: "2026-01-31" },
        { from: "2026-02-01", to: "2026-02-15" }
      ]
    ]);
  });

  it("collects auto monthly ranges and deduplicates corporations by business number", async () => {
    const requestedUrls: string[] = [];
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      fetch: async (url) => {
        requestedUrls.push(String(url));
        const params = new URL(String(url)).searchParams;
        const begin = params.get("inqryBgnDt");
        const bizno = begin === "202601010000" ? "1111111111" : "2222222222";
        return new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00", resultMsg: "정상" },
              body: {
                pageNo: 1,
                numOfRows: 100,
                totalCount: 1,
                items: {
                  item: [
                    {
                      bizno,
                      corpNm: begin === "202601010000" ? "중복회사" : "다른회사"
                    }
                  ]
                }
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const corporations = await client.collectAutoMonthly({
      from: "2026-01-01",
      to: "2026-03-31",
      workerCount: 5,
      monthsPerWorker: 10
    });

    expect(requestedUrls.map((url) => new URL(url).searchParams.get("inqryBgnDt"))).toEqual([
      "202601010000",
      "202602010000",
      "202603010000"
    ]);
    expect(corporations.map((corp) => corp.bizno)).toEqual(["1111111111", "2222222222"]);
  });

  it("resumes auto monthly collection from a saved page checkpoint", async () => {
    const requestedPages: string[] = [];
    const progressUpdates: Array<{ completed: boolean; nextPage: number; range: { from: string; to: string } }> = [];
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      requestDelayMs: 0,
      fetch: async (url) => {
        const params = new URL(String(url)).searchParams;
        requestedPages.push(params.get("pageNo") ?? "");
        return new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00", resultMsg: "normal" },
              body: {
                pageNo: Number(params.get("pageNo")),
                numOfRows: 1,
                totalCount: 3,
                items: {
                  item: [{ bizno: "3333333333", corpNm: "third page corporation" }]
                }
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const corporations = await client.collectAutoMonthly({
      from: "2026-01-01",
      to: "2026-01-31",
      workerCount: 1,
      monthsPerWorker: 10,
      numOfRows: 1,
      flushSize: 1,
      getRangeProgress: () => ({ completed: false, nextPage: 3 }),
      onRangeProgress: (progress) => {
        progressUpdates.push(progress);
      }
    });

    expect(requestedPages).toEqual(["3"]);
    expect(corporations.map((corp) => corp.bizno)).toEqual(["3333333333"]);
    expect(progressUpdates).toEqual([
      {
        completed: true,
        nextPage: 4,
        range: { from: "2026-01-01", to: "2026-01-31" }
      }
    ]);
  });

  it("skips auto monthly ranges that are already completed", async () => {
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      requestDelayMs: 0,
      fetch: async () => {
        throw new Error("completed ranges should not be fetched");
      }
    });

    const corporations = await client.collectAutoMonthly({
      from: "2026-01-01",
      to: "2026-01-31",
      workerCount: 1,
      getRangeProgress: () => ({ completed: true, nextPage: 2 })
    });

    expect(corporations).toEqual([]);
  });

  it("flushes collected corporations every 50 items while auto collecting", async () => {
    const flushed: string[][] = [];
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      requestDelayMs: 0,
      fetch: async () =>
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00", resultMsg: "정상" },
              body: {
                pageNo: 1,
                numOfRows: 100,
                totalCount: 52,
                items: {
                  item: Array.from({ length: 52 }, (_, index) => ({
                    bizno: String(1000000000 + index),
                    corpNm: `업체${index + 1}`
                  }))
                }
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    });

    await client.collectAutoMonthly({
      from: "2026-01-01",
      to: "2026-01-31",
      workerCount: 1,
      flushSize: 50,
      onItems: (items) => {
        flushed.push(items.map((item) => item.bizno ?? ""));
      }
    });

    expect(flushed).toHaveLength(2);
    expect(flushed[0]).toHaveLength(50);
    expect(flushed[0]?.[0]).toBe("1000000000");
    expect(flushed[0]?.[49]).toBe("1000000049");
    expect(flushed[1]).toEqual(["1000000050", "1000000051"]);
  });

  it("stops auto collection when the abort signal is triggered", async () => {
    const abortController = new AbortController();
    let calls = 0;
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      requestDelayMs: 0,
      fetch: async () => {
        calls += 1;
        abortController.abort();
        return new Response(
          JSON.stringify({
            response: {
              header: { resultCode: "00", resultMsg: "정상" },
              body: {
                pageNo: 1,
                numOfRows: 100,
                totalCount: 1,
                items: { item: [{ bizno: "1111111111", corpNm: "중지회사" }] }
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    await client.collectAutoMonthly({
      from: "2026-01-01",
      to: "2026-03-31",
      workerCount: 1,
      signal: abortController.signal
    });

    expect(calls).toBe(1);
  });

  it("treats the public data no-data result as an empty corporation list", async () => {
    const client = new NaraProcurementCorpClient({
      apiKey: "sample-key",
      fetch: async () =>
        new Response(
          JSON.stringify({
            response: {
              header: {
                resultCode: "03",
                resultMsg: "No Data"
              },
              body: { items: [] }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    });

    await expect(client.findByBusinessNumber("1234567890")).resolves.toEqual([]);
  });

  it("throws a clear error when the API key is missing", () => {
    expect(() => createProcurementCorpClientFromEnv({})).toThrow(/NARA_API_KEY/);
  });
});
