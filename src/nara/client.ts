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
  maxPages?: number;
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
    const dateRanges = splitNaraDateRanges(options.from, options.to);
    const numOfRows = options.numOfRows ?? 100;
    const maxPages = options.maxPages ?? 10;
    const noticesByEndpoint = await Promise.all(
      this.endpoints.map(async (endpoint) => {
        const endpointNotices: RawNaraNotice[] = [];

        for (const range of dateRanges) {
          for (let pageNo = options.pageNo ?? 1; pageNo <= maxPages; pageNo += 1) {
            const url = this.buildSearchUrl(
              {
                ...options,
                from: range.from,
                to: range.to,
                pageNo,
                numOfRows
              },
              endpoint.url
            );
            const response = await this.fetchImpl(url);

            if (!response.ok) {
              throw new Error(`Nara API request failed: ${response.status} ${response.statusText}`);
            }

            const payload = (await response.json()) as unknown;
            if (isNoDataResult(payload)) {
              break;
            }
            throwIfApiError(payload);

            const pageItems = extractItems(payload);
            endpointNotices.push(
              ...pageItems.map((notice) => ({
                ...notice,
                noticeTypeHint: endpoint.noticeType
              }))
            );

            if (!shouldLoadNextPage(payload, pageNo, numOfRows, pageItems.length)) {
              break;
            }
          }
        }

        return endpointNotices;
      })
    );

    return dedupeByNoticeId(noticesByEndpoint.flat());
  }

  buildSearchUrl(options: NaraNoticeSearchOptions, endpointUrl = this.endpoints[0]?.url ?? BASE_ENDPOINT): string {
    const url = new URL(endpointUrl);
    url.searchParams.set("serviceKey", normalizeServiceKey(this.apiKey));
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

function splitNaraDateRanges(from: string, to: string): Array<{ from: string; to: string }> {
  const start = readDateParts(from);
  const end = readDateParts(to);
  const startTime = Date.UTC(start.year, start.month - 1, start.day);
  const endTime = Date.UTC(end.year, end.month - 1, end.day);

  if (startTime > endTime) {
    throw new Error("--from must be earlier than or equal to --to.");
  }

  const ranges: Array<{ from: string; to: string }> = [];
  let cursor = start;

  while (Date.UTC(cursor.year, cursor.month - 1, cursor.day) <= endTime) {
    const lastDayOfMonth = new Date(Date.UTC(cursor.year, cursor.month, 0)).getUTCDate();
    const rangeEnd =
      cursor.year === end.year && cursor.month === end.month
        ? end
        : { year: cursor.year, month: cursor.month, day: lastDayOfMonth };

    ranges.push({
      from: `${formatDateParts(cursor)}0000`,
      to: `${formatDateParts(rangeEnd)}2359`
    });

    const nextMonth = cursor.month === 12 ? 1 : cursor.month + 1;
    const nextYear = cursor.month === 12 ? cursor.year + 1 : cursor.year;
    cursor = { year: nextYear, month: nextMonth, day: 1 };
  }

  return ranges;
}

function readDateParts(value: string): { year: number; month: number; day: number } {
  const text = value.trim();
  const compact = /^(\d{4})(\d{2})(\d{2})(?:\d{4})?$/.exec(text);
  if (compact) {
    return { year: Number(compact[1]), month: Number(compact[2]), day: Number(compact[3]) };
  }

  const dashed = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.exec(text);
  if (dashed) {
    return { year: Number(dashed[1]), month: Number(dashed[2]), day: Number(dashed[3]) };
  }

  throw new Error("--from and --to must be YYYY-MM-DD, YYYY-MM-DD HH:mm, or YYYYMMDDHHMM.");
}

function formatDateParts(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}${String(parts.month).padStart(2, "0")}${String(parts.day).padStart(2, "0")}`;
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

function shouldLoadNextPage(payload: unknown, pageNo: number, numOfRows: number, pageItemCount: number): boolean {
  if (pageItemCount === 0) {
    return false;
  }

  const totalCount = readNumber(readResponseBody(payload)?.totalCount);
  if (totalCount !== undefined) {
    return pageNo * numOfRows < totalCount;
  }

  return pageItemCount >= numOfRows;
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

function readResponseBody(payload: unknown): Record<string, unknown> | undefined {
  const root = asRecord(payload);
  const response = asRecord(root?.response);
  return asRecord(response?.body);
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

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeServiceKey(serviceKey: string): string {
  const trimmed = serviceKey.trim();
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}
