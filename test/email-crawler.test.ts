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

  it("falls back to http when an schemeless homepage fails over https", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url) === "https://vendor.example/") {
        throw new Error("TLS failed");
      }
      if (String(url) === "http://vendor.example/") {
        return htmlResponse("<p>sales@vendor.example</p>");
      }
      throw new Error(`unexpected URL ${String(url)}`);
    });

    const result = await crawlHomepageForEmails({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      homepageUrl: "vendor.example",
      requestDelayMs: 0
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://vendor.example/",
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://vendor.example/",
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(result.status).toBe("found");
    expect(result.emails).toEqual(["sales@vendor.example"]);
    expect(result.sourceUrls).toEqual(["http://vendor.example/"]);
  });

  it("returns a failed result for an invalid homepage URL without fetching", async () => {
    const fetchImpl = vi.fn();

    const result = await crawlHomepageForEmails({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      homepageUrl: "https://",
      requestDelayMs: 0
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.status).toBe("failed");
    expect(result.emails).toEqual([]);
    expect(result.error).toContain("Invalid URL");
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
