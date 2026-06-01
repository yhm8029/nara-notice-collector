import { describe, expect, it } from "vitest";
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
      "지역",
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
      .send({ from: "2026-05-01", to: "2026-05-31", keyword: "자동제어" })
      .expect(400);

    expect(response.body.error).toContain("NARA_API_KEY");
  });

  it("exports the posted notices as CSV", async () => {
    const app = await createWebApp({ enableVite: false });
    const sample = await request(app).get("/api/sample-notices").expect(200);

    const response = await request(app)
      .post("/api/export?format=csv")
      .send({ notices: sample.body.notices.slice(0, 1) })
      .expect(200);

    expect(response.header["content-type"]).toContain("text/csv");
    expect(response.text.split("\n")[0]).toBe("No.,공고번호,공고명,구분,기관명,지역,예산,마감일,업종제한,원문링크");
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
});
