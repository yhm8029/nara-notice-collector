import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../src/web/client/App.js";

describe("web client", () => {
  it("renders local web UI controls", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("나라장터 공고 컬렉터");
    expect(html).not.toContain("nara-notice-collector");
    expect(html).toContain("샘플 데이터");
    expect(html).toContain("API 수집");
    expect(html).toContain("CSV");
    expect(html).toContain("Excel");
    expect(html).toContain("최근 7일");
    expect(html).toContain("이번 달");
    expect(html).toContain("행정복지센터");
    expect(html).toContain("전체 유형");
    expect(html).toContain("검토 상태");
    expect(html).toContain("미검토");
    expect(html).toContain("검토중");
    expect(html).toContain("관심");
    expect(html).toContain("제외");
    expect(html).toContain("마감일 빠른순");
    expect(html).toContain("마감 상태");
    expect(html).toContain("선택");
    expect(html).toContain("상세");
    expect(html).toContain("검토 메모");
    expect(html).toContain("태그");
    expect(html).toContain("공고문 페이지");
    expect(html).toContain("공고문 보기");
    expect(html).not.toContain("<th>원문링크</th>");
    expect(html).not.toContain("<th>공고문</th>");
    expect(html).not.toContain("자동제어");
    expect(html).not.toContain("임박");
  });
});
