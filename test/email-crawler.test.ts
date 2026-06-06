import { describe, expect, it, vi } from "vitest";
import { crawlHomepageForEmails, extractEmailsFromHtml, normalizeHomepageUrl } from "../src/email/email-crawler.js";

describe("email crawler", () => {
  it("normalizes homepages without a scheme", () => {
    expect(normalizeHomepageUrl("example.com")).toBe("https://example.com/");
  });

  it("extracts visible and mailto email addresses from HTML", () => {
    expect(
      extractEmailsFromHtml(`
        <a href="mailto:sales@company.example?subject=hello">mail</a>
        <p>support@company.example.</p>
      `)
    ).toEqual(["sales@company.example", "support@company.example"]);
  });

  it("follows a likely contact page when the homepage has no email", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith("/contact")) {
        return htmlResponse("<p>문의: bid@vendor.example</p>");
      }

      return htmlResponse('<a href="/contact">Contact</a>');
    });

    const result = await crawlHomepageForEmails({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      homepageUrl: "vendor.example",
      requestDelayMs: 0
    });

    expect(result).toEqual({
      emails: ["bid@vendor.example"],
      sourceUrls: ["https://vendor.example/contact"],
      status: "found"
    });
  });
});

function htmlResponse(html: string) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => html
  };
}
