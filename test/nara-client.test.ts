import { describe, expect, it } from "vitest";
import { NaraApiClient, createNaraClientFromEnv } from "../src/nara/client.js";

describe("NaraApiClient", () => {
  it("throws a clear error when the API key is missing", () => {
    expect(() => createNaraClientFromEnv({})).toThrow(/NARA_API_KEY/);
  });

  it("builds public-data requests for each Nara notice business endpoint and returns typed raw notice items", async () => {
    const requestedUrls: string[] = [];
    const client = new NaraApiClient({
      apiKey: "sample-key",
      fetch: async (url) => {
        requestedUrls.push(String(url));
        const noticeId = `2026050000${requestedUrls.length}`;
        return new Response(
          JSON.stringify({
            response: {
              body: {
                items: [
                  {
                    bidNtceNo: noticeId,
                    bidNtceNm: "API 업무구분 공고",
                    ntceInsttNm: "OO교육지원청"
                  }
                ]
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const notices = await client.searchNotices({
      from: "2026-05-01",
      to: "2026-05-31",
      keyword: "행정복지센터"
    });

    expect(notices).toHaveLength(4);
    expect(notices.map((notice) => notice.noticeTypeHint)).toEqual([
      "construction",
      "service",
      "goods",
      "domestic"
    ]);
    expect(requestedUrls).toHaveLength(4);
    expect(requestedUrls[0]).toContain("getBidPblancListInfoCnstwkPPSSrch");
    expect(requestedUrls[1]).toContain("getBidPblancListInfoServcPPSSrch");
    expect(requestedUrls[2]).toContain("getBidPblancListInfoThngPPSSrch");
    expect(requestedUrls[3]).toContain("getBidPblancListInfoFrgcptPPSSrch");
    expect(requestedUrls[0]).toContain("serviceKey=sample-key");
    expect(requestedUrls[0]).toContain("inqryDiv=1");
    expect(requestedUrls[0]).toContain("inqryBgnDt=202605010000");
    expect(requestedUrls[0]).toContain("inqryEndDt=202605312359");
    expect(decodeURIComponent(requestedUrls[0] ?? "")).toContain("bidNtceNm=행정복지센터");
  });

  it("decodes encoded public-data service keys before adding them to the request", async () => {
    const requestedUrls: string[] = [];
    const client = new NaraApiClient({
      apiKey: "abc%2Bdef%2Fghi%3D",
      endpoints: [{ url: "https://example.com/api", noticeType: "goods" }],
      fetch: async (url) => {
        requestedUrls.push(String(url));
        return new Response(JSON.stringify({ response: { body: { items: [] } } }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
    });

    await client.searchNotices({ from: "2026-05-01", to: "2026-05-31" });

    const requestedUrl = new URL(requestedUrls[0] ?? "");
    expect(requestedUrl.searchParams.get("serviceKey")).toBe("abc+def/ghi=");
  });

  it("splits long date ranges into monthly public-data API requests", async () => {
    const requestedUrls: string[] = [];
    const client = new NaraApiClient({
      apiKey: "sample-key",
      endpoints: [{ url: "https://example.com/api", noticeType: "goods" }],
      fetch: async (url) => {
        requestedUrls.push(String(url));
        return new Response(JSON.stringify({ response: { body: { items: [] } } }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
    });

    await client.searchNotices({ from: "2026-01-01", to: "2026-05-31" });

    expect(
      requestedUrls.map((url) => {
        const params = new URL(url).searchParams;
        return [params.get("inqryBgnDt"), params.get("inqryEndDt")];
      })
    ).toEqual([
      ["202601010000", "202601312359"],
      ["202602010000", "202602282359"],
      ["202603010000", "202603312359"],
      ["202604010000", "202604302359"],
      ["202605010000", "202605312359"]
    ]);
  });

  it("loads additional pages when the API reports more results than one page", async () => {
    const requestedUrls: string[] = [];
    const client = new NaraApiClient({
      apiKey: "sample-key",
      endpoints: [{ url: "https://example.com/api", noticeType: "goods" }],
      fetch: async (url) => {
        requestedUrls.push(String(url));
        const pageNo = new URL(String(url)).searchParams.get("pageNo");
        const item =
          pageNo === "1"
            ? [
                { bidNtceNo: "20260500001", bidNtceNm: "첫번째" },
                { bidNtceNo: "20260500002", bidNtceNm: "두번째" }
              ]
            : [{ bidNtceNo: "20260500003", bidNtceNm: "세번째" }];

        return new Response(
          JSON.stringify({
            response: {
              body: {
                pageNo: Number(pageNo),
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

    const notices = await client.searchNotices({ from: "2026-05-01", to: "2026-05-31", numOfRows: 2 });

    expect(notices.map((notice) => notice.bidNtceNo)).toEqual(["20260500001", "20260500002", "20260500003"]);
    expect(requestedUrls.map((url) => new URL(url).searchParams.get("pageNo"))).toEqual(["1", "2"]);
  });

  it("throws the public data API result message when the API returns an error code", async () => {
    const client = new NaraApiClient({
      apiKey: "sample-key",
      endpoints: [{ url: "https://example.com/api", noticeType: "goods" }],
      fetch: async () =>
        new Response(
          JSON.stringify({
            response: {
              header: {
                resultCode: "08",
                resultMsg: "필수값 입력 에러"
              },
              body: { items: [] }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    });

    await expect(client.searchNotices({ from: "2026-05-01", to: "2026-05-31" })).rejects.toThrow(
      /필수값 입력 에러/
    );
  });

  it("treats the public data no-data result as an empty notice list", async () => {
    const client = new NaraApiClient({
      apiKey: "sample-key",
      endpoints: [{ url: "https://example.com/api", noticeType: "goods" }],
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

    await expect(client.searchNotices({ from: "2026-05-01", to: "2026-05-31" })).resolves.toEqual([]);
  });

  it("deduplicates notices by notice id", async () => {
    const client = new NaraApiClient({
      apiKey: "sample-key",
      fetch: async () =>
        new Response(
          JSON.stringify({
            response: {
              body: {
                items: [
                  { bidNtceNo: "20260500001", bidNtceNm: "첫번째" },
                  { bidNtceNo: "20260500001", bidNtceNm: "중복" }
                ]
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    });

    const notices = await client.searchNotices({ from: "2026-05-01", to: "2026-05-31" });

    expect(notices).toHaveLength(1);
    expect(notices[0]?.bidNtceNm).toBe("첫번째");
  });

  it("throws a helpful message when the API call fails", async () => {
    const client = new NaraApiClient({
      apiKey: "sample-key",
      fetch: async () => new Response("server error", { status: 500, statusText: "Server Error" })
    });

    await expect(client.searchNotices({ from: "2026-05-01", to: "2026-05-31" })).rejects.toThrow(
      /Nara API request failed/
    );
  });
});
