export type EmailCrawlStatus = "found" | "not_found" | "failed";

export type EmailCrawlResult = {
  emails: string[];
  error?: string;
  sourceUrls: string[];
  status: EmailCrawlStatus;
};

export type EmailCrawlOptions = {
  fetchImpl?: typeof fetch;
  homepageUrl: string;
  maxPages?: number;
  requestDelayMs?: number;
  signal?: AbortSignal;
};

const CONTACT_HINTS = [
  "contact",
  "about",
  "company",
  "support",
  "customer",
  "inquiry",
  "문의",
  "고객",
  "연락",
  "회사",
  "소개",
  "오시는"
];

const USER_AGENT = "nara-notice-collector-email-bot/0.1 (+local business contact extraction)";

export function normalizeHomepageUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Homepage URL is required.");
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withScheme);
  return parsed.href;
}

export function buildHomepageCrawlStartUrls(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Homepage URL is required.");
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return [normalizeHomepageUrl(trimmed)];
  }

  return [normalizeHomepageUrl(`https://${trimmed}`), normalizeHomepageUrl(`http://${trimmed}`)];
}

export function extractEmailsFromHtml(html: string): string[] {
  const found = new Set<string>();
  const decodedHtml = decodeHtmlEntities(html);

  for (const match of decodedHtml.matchAll(/mailto:([^"'<>\s?]+)/gi)) {
    const value = cleanEmail(decodeURIComponent(match[1] ?? ""));
    if (value) {
      found.add(value);
    }
  }

  for (const match of decodedHtml.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    const value = cleanEmail(match[0]);
    if (value) {
      found.add(value);
    }
  }

  return [...found].sort((left, right) => left.localeCompare(right));
}

export async function crawlHomepageForEmails(options: EmailCrawlOptions): Promise<EmailCrawlResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxPages = Math.max(1, Math.floor(options.maxPages ?? 4));
  let startUrls: string[];
  try {
    startUrls = buildHomepageCrawlStartUrls(options.homepageUrl);
  } catch (error) {
    return {
      emails: [],
      error: error instanceof Error ? error.message : String(error),
      sourceUrls: [],
      status: "failed"
    };
  }
  const queue = [...startUrls];
  const visited = new Set<string>();
  const emails = new Set<string>();
  const sourceUrls = new Set<string>();
  let successfulPageCount = 0;
  let lastError: string | undefined;

  while (queue.length > 0 && visited.size < maxPages) {
    if (options.signal?.aborted) {
      break;
    }

    const currentUrl = queue.shift();
    if (!currentUrl || visited.has(currentUrl)) {
      continue;
    }
    visited.add(currentUrl);
    await sleep(options.requestDelayMs ?? 500);

    try {
      const response = await fetchImpl(currentUrl, {
        headers: { "user-agent": USER_AGENT },
        signal: options.signal
      });
      if (!response.ok) {
        lastError = `${response.status} ${response.statusText}`;
        continue;
      }

      successfulPageCount += 1;
      const html = await response.text();
      const pageEmails = extractEmailsFromHtml(html);
      if (pageEmails.length > 0) {
        for (const email of pageEmails) {
          emails.add(email);
        }
        sourceUrls.add(currentUrl);
        break;
      }

      for (const link of discoverContactLinks(currentUrl, html)) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (emails.size > 0) {
    return { emails: [...emails].sort((left, right) => left.localeCompare(right)), sourceUrls: [...sourceUrls], status: "found" };
  }

  if (visited.size === 0 || successfulPageCount === 0) {
    return { emails: [], error: lastError, sourceUrls: [], status: "failed" };
  }

  return { emails: [], error: lastError, sourceUrls: [], status: "not_found" };
}

function discoverContactLinks(pageUrl: string, html: string): string[] {
  const baseUrl = new URL(pageUrl);
  const links: { href: string; score: number }[] = [];

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1] ?? "";
    const label = stripTags(match[2] ?? "");
    if (href.startsWith("#") || /^mailto:/i.test(href) || /^tel:/i.test(href)) {
      continue;
    }

    let parsed: URL;
    try {
      parsed = new URL(href, baseUrl);
    } catch {
      continue;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      continue;
    }
    if (parsed.hostname !== baseUrl.hostname) {
      continue;
    }

    const haystack = `${parsed.pathname} ${parsed.search} ${label}`.toLowerCase();
    const score = CONTACT_HINTS.reduce((sum, hint) => sum + (haystack.includes(hint.toLowerCase()) ? 1 : 0), 0);
    if (score > 0) {
      links.push({ href: parsed.href, score });
    }
  }

  return links
    .sort((left, right) => right.score - left.score || left.href.localeCompare(right.href))
    .map((link) => link.href)
    .slice(0, 3);
}

function cleanEmail(value: string): string | undefined {
  const cleaned = value.trim().replace(/[),.;:]+$/g, "").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return undefined;
  }
  if (/\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(cleaned)) {
    return undefined;
  }
  return cleaned;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#64;/g, "@")
    .replace(/&commat;/g, "@")
    .replace(/&#46;/g, ".")
    .replace(/&period;/g, ".");
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}
