import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createWebApp } from "../src/web/server.js";

describe("local web server API", () => {
  it("returns sample notices as fixed export rows and normalized notices", async () => {
    const app = await createWebApp({ enableVite: false });

    const response = await request(app).get("/api/sample-notices").expect(200);

    expect(response.body.rows).toHaveLength(22);
    expect(Object.keys(response.body.rows[0])).toEqual([
      "No.",
      "공고번호",
      "공고명",
      "구분",
      "기관명",
      "예산",
      "마감일",
      "업종제한",
      "원문링크"
    ]);
    expect(response.body.notices).toHaveLength(22);
  });

  it("returns a readable collect error when the API key is missing", async () => {
    const app = await createWebApp({ enableVite: false, env: {} });

    const response = await request(app)
      .post("/api/collect")
      .send({ from: "2026-05-01", to: "2026-05-31", keyword: "행정복지센터" })
      .expect(400);

    expect(response.body.error).toBe("API 키를 입력하거나 로컬 환경변수 NARA_API_KEY를 설정하세요.");
  });

  it("collects procurement corporation rows from the local API", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        responseJson({
          response: {
            header: { resultCode: "00", resultMsg: "정상" },
            body: {
              pageNo: 1,
              numOfRows: 100,
              totalCount: 1,
              items: {
                item: [
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
                ]
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        responseJson({
          response: {
            header: { resultCode: "00", resultMsg: "정상" },
            body: {
              pageNo: 1,
              numOfRows: 100,
              totalCount: 1,
              items: {
                item: [
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
        })
      );
    const app = await createWebApp({ enableVite: false, fetch: fetchImpl });

    const response = await request(app)
      .post("/api/procurement-corps/collect")
      .send({ from: "2026-06-01", to: "2026-06-05", apiKey: "sample-key" })
      .expect(200);

    expect(response.body.rows).toEqual([
      {
        "No.": 1,
        "사업자등록번호": "1111111111",
        "업체명": "첫번째회사",
        "대표자명": "대표일",
        "주소": "서울특별시 중구",
        "상세주소": "1층",
        "지역명": "서울특별시 중구",
        "업종/업무구분": "물품",
        "업종상세": "software business(1426, normal)",
        "전화번호": "02-1111-1111",
        "팩스번호": "02-1111-1112",
        "홈페이지주소": "first.example.com"
      }
    ]);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("inqryDiv=2");
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain("getPrcrmntCorpIndstrytyInfo02");
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain("inqryDiv=1");
  });

  it("collects procurement corporations without visible date inputs by using the automatic range", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      responseJson({
        response: {
          header: { resultCode: "00", resultMsg: "정상" },
          body: {
            pageNo: 1,
            numOfRows: 100,
            totalCount: 1,
            items: {
              item: [
                {
                  bizno: "1111111111",
                  corpNm: "자동수집회사",
                  ceoNm: "대표일"
                }
              ]
            }
          }
        }
      })
    );
    const app = await createWebApp({ enableVite: false, fetch: fetchImpl });

    const response = await request(app)
      .post("/api/procurement-corps/collect")
      .send({
        apiKey: "sample-key",
        workerCount: 5,
        from: "2026-01-01",
        to: "2026-01-31"
      })
      .expect(200);

    expect(response.body.rows[0]["업체명"]).toBe("자동수집회사");
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("inqryBgnDt=202601010000");
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("inqryEndDt=202601312359");
  });

  it("returns email collection candidates with industry details and homepage only", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        responseJson({
          response: {
            header: { resultCode: "00", resultMsg: "정상" },
            body: {
              pageNo: 1,
              numOfRows: 100,
              totalCount: 3,
              items: {
                item: [
                  {
                    bizno: "1111111111",
                    corpNm: "industry corporation",
                    hmpgAdrs: "industry.example.com"
                  },
                  {
                    bizno: "2222222222",
                    corpNm: "plain corporation",
                    hmpgAdrs: "plain.example.com"
                  },
                  {
                    bizno: "3333333333",
                    corpNm: "industry without homepage",
                    hmpgAdrs: ""
                  }
                ]
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        responseJson({
          response: {
            header: { resultCode: "00", resultMsg: "정상" },
            body: {
              pageNo: 1,
              numOfRows: 100,
              totalCount: 1,
              items: {
                item: [
                  {
                    bizno: "1111111111",
                    indstrytyCd: "0037",
                    indstrytyNm: "전기공사업",
                    rprsntIndstrytyYn: "Y"
                  }
                ]
              }
            }
          }
        })
      )
      .mockResolvedValueOnce(
        responseJson({
          response: {
            header: { resultCode: "03", resultMsg: "No Data" },
            body: { items: [] }
          }
        })
      )
      .mockResolvedValueOnce(
        responseJson({
          response: {
            header: { resultCode: "00", resultMsg: "정상" },
            body: {
              pageNo: 1,
              numOfRows: 100,
              totalCount: 1,
              items: {
                item: [
                  {
                    bizno: "3333333333",
                    indstrytyCd: "1426",
                    indstrytyNm: "software business"
                  }
                ]
              }
            }
          }
        })
      );
    const app = await createWebApp({ enableVite: false, fetch: fetchImpl });

    await request(app)
      .post("/api/procurement-corps/collect")
      .send({ from: "2026-06-01", to: "2026-06-30", apiKey: "sample-key" })
      .expect(200);

    const response = await request(app).get("/api/email-collection/candidates?page=1&pageSize=20").expect(200);

    expect(response.body.totalCount).toBe(1);
    expect(response.body.rows[0]["사업자등록번호"]).toBe("1111111111");
    expect(response.body.rows[0]["업종상세"]).toBe("전기공사업(0037, 대표)");
  });

  it("exports the posted notices as CSV", async () => {
    const app = await createWebApp({ enableVite: false });
    const sample = await request(app).get("/api/sample-notices").expect(200);

    const response = await request(app)
      .post("/api/export?format=csv")
      .send({ notices: sample.body.notices.slice(0, 1) })
      .expect(200);

    expect(response.header["content-type"]).toContain("text/csv");
    expect(response.text.split("\n")[0]).toBe("No.,공고번호,공고명,구분,기관명,예산,마감일,업종제한,원문링크");
  });

  it("exports the posted notices as XLSX", async () => {
    const app = await createWebApp({ enableVite: false });
    const sample = await request(app).get("/api/sample-notices").expect(200);

    const response = await request(app)
      .post("/api/export?format=xlsx")
      .send({ notices: sample.body.notices.slice(0, 1) })
      .expect(200);

    expect(response.header["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(Number(response.header["content-length"])).toBeGreaterThan(1000);
  });

  it("returns a Synap viewer URL from the configured template", async () => {
    const app = await createWebApp({
      enableVite: false,
      env: {
        SYNAP_VIEWER_URL_TEMPLATE: "https://synap.example.com/view?url={url}&title={title}"
      }
    });

    const response = await request(app)
      .get("/api/viewer-url")
      .query({
        url: "https://example.com/notices/20260500001",
        title: "행정복지센터 안내 장비 구매"
      })
      .expect(200);

    expect(response.body.mode).toBe("synap");
    expect(response.body.viewerUrl).toContain("/viewer?");
    expect(decodeURIComponent(response.body.viewerUrl)).toContain("https://synap.example.com/view?");
  });

  it("does not open a non-Synap source URL when Synap is not configured", async () => {
    const app = await createWebApp({ enableVite: false, env: {} });

    const response = await request(app)
      .get("/api/viewer-url")
      .query({ url: "https://example.com/notices/20260500002", title: "공고" })
      .expect(502);

    expect(response.body.error).toBe("Synap 공고문 보기 URL이 없어 다운로드를 차단했습니다.");
  });

  it("resolves G2B attachment download URLs to Synap viewer URLs", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        responseJson({
          dmItemMap: {
            itemPbancUntyAtchFileNo: "98297098-7712-4f8a-b3f7-99729b86c1e8"
          }
        })
      )
      .mockResolvedValueOnce(
        responseJson({
          result: {
            viewUrlPath:
              "https://www.g2b.go.kr/SynapDocViewServer/viewer/doc.html?key=route-resolved-key&convType=img&convLocale=ko_KR&contextPath=/SynapDocViewServer"
          }
        })
      );
    const app = await createWebApp({ enableVite: false, env: {}, fetch: fetchImpl });

    const response = await request(app)
      .get("/api/viewer-url")
      .query({
        url: "https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R25BK00829479&bidPbancOrd=000&fileSeq=2&prcmBsneSeCd=05",
        title: "공고문"
      })
      .expect(200);

    expect(response.body).toEqual({
      mode: "synap",
      viewerUrl:
        "/viewer?url=https%3A%2F%2Fwww.g2b.go.kr%2FSynapDocViewServer%2Fviewer%2Fdoc.html%3Fkey%3Droute-resolved-key%26convType%3Dimg%26convLocale%3Dko_KR%26contextPath%3D%2FSynapDocViewServer&title=%EA%B3%B5%EA%B3%A0%EB%AC%B8"
    });
  });

  it("renders the local viewer page as HTML with an embedded Synap iframe", async () => {
    const app = await createWebApp({ enableVite: false, env: {} });
    const synapUrl =
      "https://www.g2b.go.kr/SynapDocViewServer/viewer/doc.html?key=test-key&convType=img&convLocale=ko_KR&contextPath=/SynapDocViewServer";

    const response = await request(app)
      .get("/viewer")
      .query({ url: synapUrl, title: "공고문" })
      .expect(200);

    expect(response.header["content-type"]).toContain("text/html");
    expect(response.header["content-disposition"]).toBeUndefined();
    expect(response.text).toContain("<iframe");
    expect(response.text).toContain(synapUrl.replaceAll("&", "&amp;"));
  });

  it("rejects non-Synap document URLs on the local viewer page", async () => {
    const app = await createWebApp({ enableVite: false, env: {} });

    const response = await request(app)
      .get("/viewer")
      .query({
        url: "https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01257874&fileSeq=1",
        title: "공고문"
      })
      .expect(400);

    expect(response.body.error).toBe("Synap 공고문 보기 URL만 열 수 있습니다.");
  });

  it("does not open a G2B attachment download URL when Synap resolution fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(responseJson({ dmItemMap: {} }));
    const app = await createWebApp({ enableVite: false, env: {}, fetch: fetchImpl });

    const response = await request(app)
      .get("/api/viewer-url")
      .query({
        url: "https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R25BK00829479&bidPbancOrd=000&fileSeq=2",
        title: "공고문"
      })
      .expect(502);

    expect(response.body.error).toBe("나라장터 Synap 공고문 링크를 만들지 못했습니다.");
  });
});

function responseJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  };
}
