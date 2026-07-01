const PROCUREMENT_CORP_ENDPOINT =
  "https://apis.data.go.kr/1230000/ao/UsrInfoService02/getPrcrmntCorpBasicInfo02";
const PROCUREMENT_CORP_INDUSTRY_ENDPOINT =
  "https://apis.data.go.kr/1230000/ao/UsrInfoService02/getPrcrmntCorpIndstrytyInfo02";

export type ProcurementCorpClientConfig = {
  apiKey: string;
  endpoint?: string;
  industryEndpoint?: string;
  fetch?: typeof fetch;
  requestDelayMs?: number;
  retryDelaysMs?: number[];
};

export type ProcurementCorpSearchOptions = {
  pageNo?: number;
  numOfRows?: number;
  inqryDiv?: string;
};

export type ProcurementCorpDateRangeOptions = {
  from: string;
  to: string;
  pageNo?: number;
  numOfRows?: number;
  inqryDiv?: string;
  maxPages?: number;
  signal?: AbortSignal;
};

export type ProcurementCorpAutoMonthlyOptions = {
  from: string;
  to: string;
  ranges?: MonthRange[];
  workerCount?: number;
  monthsPerWorker?: number;
  inqryDiv?: string;
  numOfRows?: number;
  flushSize?: number;
  onItems?: (items: RawProcurementCorp[]) => Promise<void> | void;
  signal?: AbortSignal;
};

export type MonthRange = {
  from: string;
  to: string;
};

export type ProcurementCorpFailedRange = MonthRange & {
  error: string;
};

export type ProcurementCorpCollectionResult = {
  corporations: RawProcurementCorp[];
  failedRanges: ProcurementCorpFailedRange[];
};

export type RawProcurementCorp = Record<string, unknown> & {
  adrs?: string;
  bizno?: string;
  ceoNm?: string;
  corpBsnsDivNm?: string;
  corpNm?: string;
  dtlAdrs?: string;
  faxNo?: string;
  hmpgAdrs?: string;
  industryDetails?: RawProcurementCorpIndustry[];
  industryDetailSummary?: string;
  rgnNm?: string;
  telNo?: string;
};

export type RawProcurementCorpIndustry = Record<string, unknown> & {
  bizno?: string;
  chgDt?: string;
  indstrytyCd?: string;
  indstrytyNm?: string;
  indstrytyStatsNm?: string;
  rgstDt?: string;
  rprsntIndstrytyYn?: string;
  systmChgDt?: string;
  systmRgstDt?: string;
  vldPrdExprtDt?: string;
};

export type ProcurementCorpRow = {
  "No.": number;
  "사업자등록번호": string;
  "업체명": string;
  "대표자명": string;
  "주소": string;
  "상세주소": string;
  "지역명": string;
  "업종/업무구분": string;
  "업종상세": string;
  "전화번호": string;
  "팩스번호": string;
  "홈페이지주소": string;
};

export type ProcurementCorpSummary = {
  representativeName?: string;
  companyName?: string;
  businessNumber?: string;
  phoneNumber?: string;
  raw: RawProcurementCorp;
};

export type ProcurementCorpFieldSummary = {
  representativeName: FieldPresence;
  companyName: FieldPresence;
  businessNumber: FieldPresence;
  phoneNumber: FieldPresence;
};

export type FieldPresence = {
  apiField: string;
  value: string | undefined;
  present: boolean;
};

export class NaraProcurementCorpClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly industryEndpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly retryDelaysMs: readonly number[];

  constructor(config: ProcurementCorpClientConfig) {
    if (!config.apiKey) {
      throw new Error("NARA_API_KEY is required.");
    }

    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint ?? PROCUREMENT_CORP_ENDPOINT;
    this.industryEndpoint = config.industryEndpoint ?? PROCUREMENT_CORP_INDUSTRY_ENDPOINT;
    this.fetchImpl = config.fetch ?? fetch;
    this.requestDelayMs = config.requestDelayMs ?? 250;
    this.retryDelaysMs = config.retryDelaysMs ?? [1000, 2500, 5000];
  }

  async findByBusinessNumber(
    businessNumber: string,
    options: ProcurementCorpSearchOptions = {}
  ): Promise<ProcurementCorpSummary[]> {
    const url = this.buildBusinessNumberLookupUrl(businessNumber, options);
    const response = await this.fetchWithRetry(url);

    if (!response.ok) {
      throw new Error(`Nara procurement corp API request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as unknown;
    if (isNoDataResult(payload)) {
      return [];
    }
    throwIfApiError(payload);

    return extractItems(payload).map((item) => ({
      representativeName: readString(item.ceoNm),
      companyName: readString(item.corpNm),
      businessNumber: readString(item.bizno),
      phoneNumber: readString(item.telNo),
      raw: item
    }));
  }

  async collectByDateRange(options: ProcurementCorpDateRangeOptions): Promise<RawProcurementCorp[]> {
    const numOfRows = options.numOfRows ?? 100;
    const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
    const corporations: RawProcurementCorp[] = [];

    for (let pageNo = options.pageNo ?? 1; pageNo <= maxPages; pageNo += 1) {
      if (options.signal?.aborted) {
        break;
      }
      const url = this.buildDateRangeLookupUrl({ ...options, pageNo, numOfRows });
      const response = await this.fetchWithRetry(url);

      if (!response.ok) {
        throw new Error(`Nara procurement corp API request failed: ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as unknown;
      if (isNoDataResult(payload)) {
        break;
      }
      throwIfApiError(payload);

      const pageItems = extractItems(payload);
      corporations.push(...pageItems);

      if (!shouldLoadNextPage(payload, pageNo, numOfRows, pageItems.length)) {
        break;
      }
    }

    return corporations;
  }

  async collectIndustryDetailsByBusinessNumber(
    businessNumber: string,
    options: ProcurementCorpSearchOptions = {}
  ): Promise<RawProcurementCorpIndustry[]> {
    const numOfRows = options.numOfRows ?? 100;
    const industries: RawProcurementCorpIndustry[] = [];

    for (let pageNo = options.pageNo ?? 1; ; pageNo += 1) {
      const url = this.buildIndustryDetailsLookupUrl(businessNumber, { ...options, pageNo, numOfRows });
      const response = await this.fetchWithRetry(url);

      if (!response.ok) {
        throw new Error(`Nara procurement corp industry API request failed: ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as unknown;
      if (isNoDataResult(payload)) {
        break;
      }
      throwIfApiError(payload);

      const pageItems = extractItems(payload) as RawProcurementCorpIndustry[];
      industries.push(...pageItems);

      if (!shouldLoadNextPage(payload, pageNo, numOfRows, pageItems.length)) {
        break;
      }
    }

    return industries;
  }

  async enrichCorporationsWithIndustryDetails(
    corporations: RawProcurementCorp[],
    options: { signal?: AbortSignal } = {}
  ): Promise<RawProcurementCorp[]> {
    const enriched: RawProcurementCorp[] = [];

    for (const corporation of corporations) {
      if (options.signal?.aborted) {
        break;
      }

      const bizno = readString(corporation.bizno);
      if (!bizno) {
        enriched.push(corporation);
        continue;
      }

      const industryDetails = await this.collectIndustryDetailsByBusinessNumber(bizno, { numOfRows: 100 });
      enriched.push({
        ...corporation,
        industryDetails,
        industryDetailSummary: summarizeIndustryDetails(industryDetails)
      });
    }

    return enriched;
  }

  async collectAutoMonthly(options: ProcurementCorpAutoMonthlyOptions): Promise<ProcurementCorpCollectionResult> {
    const batches = options.ranges
      ? chunkMonthRanges(options.ranges, options.monthsPerWorker ?? 10)
      : buildMonthlyCorpCollectionBatches({
          from: options.from,
          to: options.to,
          monthsPerBatch: options.monthsPerWorker ?? 10
        });
    const workerCount = clampWorkerCount(options.workerCount ?? 5);
    const collected: RawProcurementCorp[] = [];
    const failedRanges: ProcurementCorpFailedRange[] = [];
    const pendingFlush: RawProcurementCorp[] = [];
    const flushSize = Math.max(1, Math.floor(options.flushSize ?? 50));
    let nextBatchIndex = 0;

    const flushPending = async (force = false) => {
      while (pendingFlush.length >= flushSize || (force && pendingFlush.length > 0)) {
        const chunk = pendingFlush.splice(0, force ? pendingFlush.length : flushSize);
        await options.onItems?.(chunk);
      }
    };

    const runWorker = async () => {
      while (nextBatchIndex < batches.length) {
        if (options.signal?.aborted) {
          break;
        }
        const batch = batches[nextBatchIndex];
        nextBatchIndex += 1;

        for (const range of batch ?? []) {
          if (options.signal?.aborted) {
            break;
          }
          let rangeItems: RawProcurementCorp[];
          try {
            rangeItems = await this.collectByDateRange({
              from: range.from,
              to: range.to,
              inqryDiv: options.inqryDiv ?? "2",
              numOfRows: options.numOfRows ?? 100,
              signal: options.signal
            });
          } catch (error) {
            if (isSkippableInputRangeError(error)) {
              failedRanges.push({
                from: range.from,
                to: range.to,
                error: error.resultMsg
              });
              continue;
            }
            throw error;
          }
          collected.push(...rangeItems);
          pendingFlush.push(...rangeItems);
          await flushPending();
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(workerCount, batches.length) }, () => runWorker()));
    await flushPending(true);
    return {
      corporations: dedupeByBusinessNumber(collected),
      failedRanges: failedRanges.sort((left, right) => left.from.localeCompare(right.from))
    };
  }

  buildBusinessNumberLookupUrl(
    businessNumber: string,
    options: ProcurementCorpSearchOptions = {}
  ): string {
    const normalizedBusinessNumber = normalizeBusinessNumber(businessNumber);
    if (!normalizedBusinessNumber) {
      throw new Error("Business number is required.");
    }

    const url = new URL(this.endpoint);
    url.searchParams.set("serviceKey", normalizeServiceKey(this.apiKey));
    url.searchParams.set("type", "json");
    url.searchParams.set("pageNo", String(options.pageNo ?? 1));
    url.searchParams.set("numOfRows", String(options.numOfRows ?? 10));
    url.searchParams.set("inqryDiv", options.inqryDiv ?? "3");
    url.searchParams.set("bizno", normalizedBusinessNumber);

    return url.toString();
  }

  buildDateRangeLookupUrl(options: ProcurementCorpDateRangeOptions): string {
    const url = new URL(this.endpoint);
    url.searchParams.set("serviceKey", normalizeServiceKey(this.apiKey));
    url.searchParams.set("type", "json");
    url.searchParams.set("pageNo", String(options.pageNo ?? 1));
    url.searchParams.set("numOfRows", String(options.numOfRows ?? 100));
    url.searchParams.set("inqryDiv", options.inqryDiv ?? "2");
    url.searchParams.set("inqryBgnDt", formatNaraDateTime(options.from, "start"));
    url.searchParams.set("inqryEndDt", formatNaraDateTime(options.to, "end"));

    return url.toString();
  }

  buildIndustryDetailsLookupUrl(businessNumber: string, options: ProcurementCorpSearchOptions = {}): string {
    const normalizedBusinessNumber = normalizeBusinessNumber(businessNumber);
    if (!normalizedBusinessNumber) {
      throw new Error("Business number is required.");
    }

    const url = new URL(this.industryEndpoint);
    url.searchParams.set("serviceKey", normalizeServiceKey(this.apiKey));
    url.searchParams.set("type", "json");
    url.searchParams.set("pageNo", String(options.pageNo ?? 1));
    url.searchParams.set("numOfRows", String(options.numOfRows ?? 100));
    url.searchParams.set("inqryDiv", options.inqryDiv ?? "1");
    url.searchParams.set("bizno", normalizedBusinessNumber);

    return url.toString();
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    await sleep(this.requestDelayMs);
    let response = await this.fetchImpl(url);

    for (const delayMs of this.retryDelaysMs) {
      if (!shouldRetryResponse(response)) {
        return response;
      }

      await sleep(delayMs);
      response = await this.fetchImpl(url);
    }

    return response;
  }
}

export function createProcurementCorpClientFromEnv(
  env: Record<string, string | undefined> = process.env
): NaraProcurementCorpClient {
  return new NaraProcurementCorpClient({ apiKey: env.NARA_API_KEY ?? "" });
}

export function summarizeProcurementCorp(item: RawProcurementCorp): ProcurementCorpFieldSummary {
  return {
    representativeName: summarizeField("ceoNm", item.ceoNm),
    companyName: summarizeField("corpNm", item.corpNm),
    businessNumber: summarizeField("bizno", item.bizno),
    phoneNumber: summarizeField("telNo", item.telNo)
  };
}

export function toProcurementCorpRows(corporations: RawProcurementCorp[]): ProcurementCorpRow[] {
  return corporations.map((corporation, index) => ({
    "No.": index + 1,
    "사업자등록번호": readString(corporation.bizno) ?? "",
    "업체명": readString(corporation.corpNm) ?? "",
    "대표자명": readString(corporation.ceoNm) ?? "",
    "주소": readString(corporation.adrs) ?? "",
    "상세주소": readString(corporation.dtlAdrs) ?? "",
    "지역명": readString(corporation.rgnNm) ?? "",
    "업종/업무구분": readString(corporation.corpBsnsDivNm) ?? "",
    "업종상세": readString(corporation.industryDetailSummary) ?? "",
    "전화번호": readString(corporation.telNo) ?? "",
    "팩스번호": readString(corporation.faxNo) ?? "",
    "홈페이지주소": readString(corporation.hmpgAdrs) ?? ""
  }));
}

function summarizeIndustryDetails(industryDetails: RawProcurementCorpIndustry[]): string {
  return industryDetails
    .map((industry) => {
      const name = readString(industry.indstrytyNm) ?? "";
      const code = readString(industry.indstrytyCd);
      if (!name && !code) {
        return undefined;
      }

      const qualifiers = [code, readString(industry.indstrytyStatsNm)].filter(
        (value): value is string => Boolean(value && value.trim())
      );
      if (readString(industry.rprsntIndstrytyYn)?.toUpperCase() === "Y") {
        qualifiers.push("대표");
      }

      const label = name || code || "";
      return qualifiers.length > 0 ? `${label}(${qualifiers.join(", ")})` : label;
    })
    .filter((value): value is string => Boolean(value))
    .join("; ");
}

export function buildMonthlyCorpCollectionBatches(options: {
  from: string;
  to: string;
  monthsPerBatch?: number;
}): MonthRange[][] {
  const monthsPerBatch = Math.max(1, Math.floor(options.monthsPerBatch ?? 10));
  const start = readDateParts(options.from);
  const end = readDateParts(options.to);
  const endTime = Date.UTC(end.year, end.month - 1, end.day);

  if (Date.UTC(start.year, start.month - 1, start.day) > endTime) {
    throw new Error("from must be earlier than or equal to to.");
  }

  const ranges: MonthRange[] = [];
  let cursor = { year: start.year, month: start.month, day: 1 };

  while (Date.UTC(cursor.year, cursor.month - 1, 1) <= endTime) {
    const isFirstMonth = cursor.year === start.year && cursor.month === start.month;
    const isLastMonth = cursor.year === end.year && cursor.month === end.month;
    const lastDayOfMonth = new Date(Date.UTC(cursor.year, cursor.month, 0)).getUTCDate();
    const rangeStart = {
      year: cursor.year,
      month: cursor.month,
      day: isFirstMonth ? start.day : 1
    };
    const rangeEnd = {
      year: cursor.year,
      month: cursor.month,
      day: isLastMonth ? end.day : lastDayOfMonth
    };

    ranges.push({
      from: formatDateParts(rangeStart),
      to: formatDateParts(rangeEnd)
    });

    const nextMonth = cursor.month === 12 ? 1 : cursor.month + 1;
    const nextYear = cursor.month === 12 ? cursor.year + 1 : cursor.year;
    cursor = { year: nextYear, month: nextMonth, day: 1 };
  }

  const batches: MonthRange[][] = [];
  for (let index = 0; index < ranges.length; index += monthsPerBatch) {
    batches.push(ranges.slice(index, index + monthsPerBatch));
  }
  return batches;
}

function summarizeField(apiField: string, value: unknown): FieldPresence {
  const text = readString(value);
  return {
    apiField,
    value: text,
    present: text !== undefined && text.trim().length > 0
  };
}

function extractItems(payload: unknown): RawProcurementCorp[] {
  const body = readResponseBody(payload);
  const items = body?.items;

  if (Array.isArray(items)) {
    return items as RawProcurementCorp[];
  }

  const item = asRecord(items)?.item;
  if (Array.isArray(item)) {
    return item as RawProcurementCorp[];
  }
  if (item && typeof item === "object") {
    return [item as RawProcurementCorp];
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
  throw new NaraProcurementCorpApiError(resultCode, resultMsg);
}

function isNoDataResult(payload: unknown): boolean {
  return readString(readResponseHeader(payload)?.resultCode) === "03";
}

function readResponseHeader(payload: unknown): Record<string, unknown> | undefined {
  const root = asRecord(payload);
  const error = asRecord(root?.["nkoneps.com.response.ResponseError"]);
  if (error) {
    return asRecord(error.header);
  }
  const response = asRecord(root?.response);
  return asRecord(response?.header);
}

function readResponseBody(payload: unknown): Record<string, unknown> | undefined {
  const root = asRecord(payload);
  const response = asRecord(root?.response);
  return asRecord(response?.body);
}

function normalizeBusinessNumber(value: string): string {
  return value.replace(/\D/g, "");
}

function chunkMonthRanges(ranges: MonthRange[], monthsPerBatch: number): MonthRange[][] {
  const size = Math.max(1, Math.floor(monthsPerBatch));
  const batches: MonthRange[][] = [];
  for (let index = 0; index < ranges.length; index += size) {
    batches.push(ranges.slice(index, index + size));
  }
  return batches;
}

function dedupeByBusinessNumber(corporations: RawProcurementCorp[]): RawProcurementCorp[] {
  const seen = new Set<string>();
  const result: RawProcurementCorp[] = [];

  for (const corporation of corporations) {
    const bizno = readString(corporation.bizno);
    if (bizno && seen.has(bizno)) {
      continue;
    }
    if (bizno) {
      seen.add(bizno);
    }
    result.push(corporation);
  }

  return result;
}

function clampWorkerCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 5;
  }
  return Math.min(5, Math.max(1, Math.floor(value)));
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

  throw new Error("from and to must be YYYY-MM-DD, YYYY-MM-DD HH:mm, or YYYYMMDDHHMM.");
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

  throw new Error("from and to must be YYYY-MM-DD, YYYY-MM-DD HH:mm, or YYYYMMDDHHMM.");
}

function formatDateParts(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function normalizeServiceKey(serviceKey: string): string {
  const trimmed = serviceKey.trim();
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
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

function shouldRetryResponse(response: Response): boolean {
  return response.status === 429 || response.status === 500 || response.status === 502 || response.status === 503;
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

class NaraProcurementCorpApiError extends Error {
  constructor(
    readonly resultCode: string,
    readonly resultMsg: string
  ) {
    super(`Nara procurement corp API returned ${resultCode}: ${resultMsg}`);
  }
}

function isSkippableInputRangeError(error: unknown): error is NaraProcurementCorpApiError {
  return error instanceof NaraProcurementCorpApiError && error.resultCode === "07";
}
