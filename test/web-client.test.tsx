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
    expect(html).toContain("공고문");
    expect(html).not.toContain("임박");
  });
});
