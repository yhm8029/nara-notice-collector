import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../src/web/client/App.js";

describe("web client", () => {
  it("renders local web UI controls", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("샘플 데이터");
    expect(html).toContain("API 수집");
    expect(html).toContain("CSV");
    expect(html).toContain("Excel");
    expect(html).toContain("나라장터 공고 검토");
    expect(html).toContain("사업자 조회");
    expect(html).toContain("사업자등록번호");
    expect(html).toContain("홈페이지주소");
    expect(html).toContain("업종상세");
    expect(html).toContain("워커 수");
    expect(html).toContain("최대 5개");
    expect(html).toContain("공고문");
    expect(html).toContain("낙찰자");
    expect(html).toContain("낙찰자 연락처");
    expect(html).toContain("행정복지센터");
    expect(html).not.toContain("자동제어");
    expect(html).not.toContain("임박");
  });
});
