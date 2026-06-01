import type { RawNaraNotice } from "./types.js";

const DEFAULT_ENDPOINT =
  "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServcPPSSrch";

export type NaraNoticeSearchOptions = {
  from: string;
  to: string;
  keyword?: string;
  pageNo?: number;
  numOfRows?: number;
};

export type NaraApiClientConfig = {
  apiKey: string;
  endpoint?: string;
  fetch?: typeof fetch;
};

export class NaraApiClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: NaraApiClientConfig) {
    if (!config.apiKey) {
      throw new Error("NARA_API_KEY is required for Nara API collection.");
    }

    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    this.fetchImpl = config.fetch ?? fetch;
  }

  async searchNotices(options: NaraNoticeSearchOptions): Promise<RawNaraNotice[]> {
    const url = this.buildSearchUrl(options);
    const response = await this.fetchImpl(url);

    if (!response.ok) {
      throw new Error(`Nara API request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as unknown;
    return dedupeByNoticeId(extractItems(payload));
  }

  buildSearchUrl(options: NaraNoticeSearchOptions): string {
    const url = new URL(this.endpoint);
    url.searchParams.set("serviceKey", this.apiKey);
    url.searchParams.set("type", "json");
    url.searchParams.set("pageNo", String(options.pageNo ?? 1));
    url.searchParams.set("numOfRows", String(options.numOfRows ?? 100));
    url.searchParams.set("inqryBgnDt", compactDate(options.from));
    url.searchParams.set("inqryEndDt", compactDate(options.to));

    if (options.keyword) {
      url.searchParams.set("bidNtceNm", options.keyword);
    }

    return url.toString();
  }
}

export function createNaraClientFromEnv(env: Record<string, string | undefined> = process.env): NaraApiClient {
  const apiKey = env.NARA_API_KEY;
  if (!apiKey) {
    throw new Error("NARA_API_KEY is required for collect mode. Set NARA_API_KEY or use the sample command.");
  }

  return new NaraApiClient({ apiKey });
}

function compactDate(value: string): string {
  return value.replaceAll("-", "");
}

function extractItems(payload: unknown): RawNaraNotice[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const root = payload as Record<string, unknown>;
  const response = asRecord(root.response);
  const body = asRecord(response?.body);
  const items = body?.items;

  if (Array.isArray(items)) {
    return items as RawNaraNotice[];
  }

  const item = asRecord(items)?.item;
  if (Array.isArray(item)) {
    return item as RawNaraNotice[];
  }
  if (item && typeof item === "object") {
    return [item as RawNaraNotice];
  }

  return [];
}

function dedupeByNoticeId(notices: RawNaraNotice[]): RawNaraNotice[] {
  const seen = new Set<string>();
  const result: RawNaraNotice[] = [];

  for (const notice of notices) {
    const id = typeof notice.bidNtceNo === "string" ? notice.bidNtceNo : undefined;
    if (id && seen.has(id)) {
      continue;
    }
    if (id) {
      seen.add(id);
    }
    result.push(notice);
  }

  return result;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}
