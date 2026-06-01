import type { NoticeType, RawNaraNotice } from "./types.js";

const BASE_ENDPOINT = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService";

export type NaraNoticeEndpoint = {
  url: string;
  noticeType: NoticeType;
};

const DEFAULT_ENDPOINTS: readonly NaraNoticeEndpoint[] = [
  {
    url: `${BASE_ENDPOINT}/getBidPblancListInfoCnstwkPPSSrch`,
    noticeType: "construction"
  },
  {
    url: `${BASE_ENDPOINT}/getBidPblancListInfoServcPPSSrch`,
    noticeType: "service"
  },
  {
    url: `${BASE_ENDPOINT}/getBidPblancListInfoThngPPSSrch`,
    noticeType: "goods"
  },
  {
    url: `${BASE_ENDPOINT}/getBidPblancListInfoFrgcptPPSSrch`,
    noticeType: "domestic"
  }
];

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
  endpoints?: readonly NaraNoticeEndpoint[];
  fetch?: typeof fetch;
};

export class NaraApiClient {
  private readonly apiKey: string;
  private readonly endpoints: readonly NaraNoticeEndpoint[];
  private readonly fetchImpl: typeof fetch;

  constructor(config: NaraApiClientConfig) {
    if (!config.apiKey) {
      throw new Error("NARA_API_KEY is required for Nara API collection.");
    }

    this.apiKey = config.apiKey;
    this.endpoints =
      config.endpoints ?? (config.endpoint ? [{ url: config.endpoint, noticeType: "domestic" }] : DEFAULT_ENDPOINTS);
    this.fetchImpl = config.fetch ?? fetch;
  }

  async searchNotices(options: NaraNoticeSearchOptions): Promise<RawNaraNotice[]> {
    const noticesByEndpoint = await Promise.all(
      this.endpoints.map(async (endpoint) => {
        const url = this.buildSearchUrl(options, endpoint.url);
        const response = await this.fetchImpl(url);

        if (!response.ok) {
          throw new Error(`Nara API request failed: ${response.status} ${response.statusText}`);
        }

        const payload = (await response.json()) as unknown;
        if (isNoDataResult(payload)) {
          return [];
        }
        throwIfApiError(payload);
        return extractItems(payload).map((notice) => ({
          ...notice,
          noticeTypeHint: endpoint.noticeType
        }));
      })
    );

    return dedupeByNoticeId(noticesByEndpoint.flat());
  }

  buildSearchUrl(options: NaraNoticeSearchOptions, endpointUrl = this.endpoints[0]?.url ?? BASE_ENDPOINT): string {
    const url = new URL(endpointUrl);
    url.searchParams.set("ServiceKey", this.apiKey);
    url.searchParams.set("type", "json");
    url.searchParams.set("inqryDiv", "1");
    url.searchParams.set("pageNo", String(options.pageNo ?? 1));
    url.searchParams.set("numOfRows", String(options.numOfRows ?? 100));
    url.searchParams.set("inqryBgnDt", formatNaraDateTime(options.from, "start"));
    url.searchParams.set("inqryEndDt", formatNaraDateTime(options.to, "end"));

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

function formatNaraDateTime(value: string, boundary: "start" | "end"): string {
  const text = value.trim();
  const compact = /^(\d{8})(\d{4})?$/.exec(text);
  if (compact) {
    return compact[2] ? text : `${text}${boundary === "start" ? "0000" : "2359"}`;
  }

  const dateTime = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?$/.exec(text);
  if (dateTime) {
    const [, year, month, day, hour, minute] = dateTime;
    return `${year}${month}${day}${hour ?? (boundary === "start" ? "00" : "23")}${minute ?? (boundary === "start" ? "00" : "59")}`;
  }

  throw new Error("--from and --to must be YYYY-MM-DD, YYYY-MM-DD HH:mm, or YYYYMMDDHHMM.");
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

function throwIfApiError(payload: unknown): void {
  const header = readResponseHeader(payload);
  const resultCode = readString(header?.resultCode);

  if (!resultCode || resultCode === "00" || resultCode === "03") {
    return;
  }

  const resultMsg = readString(header?.resultMsg) ?? "Unknown public data API error";
  throw new Error(`Nara API returned ${resultCode}: ${resultMsg}`);
}

function isNoDataResult(payload: unknown): boolean {
  return readString(readResponseHeader(payload)?.resultCode) === "03";
}

function readResponseHeader(payload: unknown): Record<string, unknown> | undefined {
  const root = asRecord(payload);
  const response = asRecord(root?.response);
  return asRecord(response?.header);
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

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
