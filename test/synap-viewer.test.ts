import { describe, expect, it } from "vitest";
import { buildSynapViewerUrl } from "../src/web/synap-viewer.js";

describe("Synap viewer URL builder", () => {
  it("wraps a notice source URL with the configured Synap viewer template", () => {
    const result = buildSynapViewerUrl(
      {
        sourceUrl: "https://example.com/notices/20260500001?file=공고문.pdf",
        title: "행정복지센터 안내 장비 구매"
      },
      {
        template: "https://viewer.example.com/view?url={url}&title={title}"
      }
    );

    expect(result).toEqual({
      mode: "synap",
      viewerUrl:
        "https://viewer.example.com/view?url=https%3A%2F%2Fexample.com%2Fnotices%2F20260500001%3Ffile%3D%25EA%25B3%25B5%25EA%25B3%25A0%25EB%25AC%25B8.pdf&title=%ED%96%89%EC%A0%95%EB%B3%B5%EC%A7%80%EC%84%BC%ED%84%B0%20%EC%95%88%EB%82%B4%20%EC%9E%A5%EB%B9%84%20%EA%B5%AC%EB%A7%A4"
    });
  });

  it("falls back to the original source URL when no Synap template is configured", () => {
    const result = buildSynapViewerUrl({
      sourceUrl: "https://example.com/notices/20260500002",
      title: "시설 점검 용역"
    });

    expect(result).toEqual({
      mode: "source",
      viewerUrl: "https://example.com/notices/20260500002",
      message: "SYNAP_VIEWER_URL_TEMPLATE is not configured. Opening the original notice link."
    });
  });

  it("rejects missing or unsafe source URLs", () => {
    expect(() => buildSynapViewerUrl({ sourceUrl: "", title: "공고" })).toThrow("sourceUrl is required");
    expect(() => buildSynapViewerUrl({ sourceUrl: "file:///C:/secret.pdf", title: "공고" })).toThrow(
      "http or https"
    );
  });

  it("requires the template to include a source URL placeholder", () => {
    expect(() =>
      buildSynapViewerUrl(
        { sourceUrl: "https://example.com/notices/20260500003", title: "공고" },
        { template: "https://viewer.example.com/view" }
      )
    ).toThrow("{url}");
  });
});
