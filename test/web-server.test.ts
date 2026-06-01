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
        SYNAP_VIEWER_URL_TEMPLATE: "https://viewer.example.com/view?url={url}&title={title}"
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
    expect(response.body.viewerUrl).toBe(
      "https://viewer.example.com/view?url=https%3A%2F%2Fexample.com%2Fnotices%2F20260500001&title=%ED%96%89%EC%A0%95%EB%B3%B5%EC%A7%80%EC%84%BC%ED%84%B0%20%EC%95%88%EB%82%B4%20%EC%9E%A5%EB%B9%84%20%EA%B5%AC%EB%A7%A4"
    );
  });

  it("falls back to the source URL when Synap is not configured", async () => {
    const app = await createWebApp({ enableVite: false, env: {} });

    const response = await request(app)
      .get("/api/viewer-url")
      .query({ url: "https://example.com/notices/20260500002", title: "공고" })
      .expect(200);

    expect(response.body).toEqual({
      mode: "source",
      viewerUrl: "https://example.com/notices/20260500002",
      message: "Synap 문서뷰어 설정이 없어 공고문 링크를 직접 엽니다."
    });
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
        "https://www.g2b.go.kr/SynapDocViewServer/viewer/doc.html?key=route-resolved-key&convType=img&convLocale=ko_KR&contextPath=/SynapDocViewServer"
    });
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
