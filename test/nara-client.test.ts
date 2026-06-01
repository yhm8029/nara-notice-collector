import { describe, expect, it } from "vitest";
import { NaraApiClient, createNaraClientFromEnv } from "../src/nara/client.js";

describe("NaraApiClient", () => {
  it("throws a clear error when the API key is missing", () => {
    expect(() => createNaraClientFromEnv({})).toThrow(/NARA_API_KEY/);
  });

  it("builds a public-data request and returns raw notice items", async () => {
    const requestedUrls: string[] = [];
    const client = new NaraApiClient({
      apiKey: "sample-key",
      fetch: async (url) => {
        requestedUrls.push(String(url));
        return new Response(
          JSON.stringify({
            response: {
              body: {
                items: [
                  {
                    bidNtceNo: "20260500001",
                    bidNtceNm: "OO초등학교 개축공사",
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
      keyword: "자동제어"
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]?.bidNtceNo).toBe("20260500001");
    expect(requestedUrls[0]).toContain("serviceKey=sample-key");
    expect(requestedUrls[0]).toContain("inqryBgnDt=20260501");
    expect(requestedUrls[0]).toContain("inqryEndDt=20260531");
    expect(decodeURIComponent(requestedUrls[0] ?? "")).toContain("bidNtceNm=자동제어");
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
