export type NoticeRow = {
  "No.": number;
  "공고번호": string;
  "공고명": string;
  "구분": string;
  "기관명": string;
  "예산": string;
  "마감일": string;
  "업종제한": string;
  "원문링크": string;
};

export type NormalizedNotice = {
  noticeId: string;
  title: string;
  noticeType: "construction" | "goods" | "service" | "domestic";
  agency: string;
  region?: string;
  budget?: number;
  deadline?: string;
  industryRestriction?: string;
  sourceUrl?: string;
  documentUrl?: string;
  raw?: Record<string, unknown>;
};

export type NoticeTypeFilter = "all" | NormalizedNotice["noticeType"];
export type SortMode = "noticeId" | "deadlineAsc" | "budgetDesc";
export type SearchPresetId = "recent7Days" | "thisMonth" | "welfareCenter";
export type ReviewStatus = "unreviewed" | "reviewing" | "interested" | "excluded";
export type ReviewStatusFilter = "all" | ReviewStatus;
export type StatusKind = "info" | "warning" | "error";
export type StatusReason =
  | "sample-loaded"
  | "collect-loaded"
  | "empty-result"
  | "missing-api-key"
  | "missing-document"
  | "export-empty";

export type WorkspaceStatus = {
  kind: StatusKind;
  message: string;
};

export type WorkspaceFilters = {
  type: NoticeTypeFilter;
  sort: SortMode;
};

export type WorkspaceSummary = {
  total: number;
  construction: number;
  goods: number;
  service: number;
  domestic: number;
};

export type NoticeMetadata = {
  memo: string;
  tags: string[];
};

export type DeadlineBadge = {
  label: string;
  tone: "normal" | "urgent" | "muted";
};

export const searchPresets: readonly { id: SearchPresetId; label: string }[] = [
  { id: "recent7Days", label: "최근 7일" },
  { id: "thisMonth", label: "이번 달" },
  { id: "welfareCenter", label: "행정복지센터" }
];

export const reviewStatuses: readonly { value: ReviewStatus; label: string }[] = [
  { value: "unreviewed", label: "미검토" },
  { value: "reviewing", label: "검토중" },
  { value: "interested", label: "관심" },
  { value: "excluded", label: "제외" }
];

export function getInitialReviewState(rows: readonly NoticeRow[]): Map<string, ReviewStatus> {
  return new Map(rows.map((row) => [row["공고번호"], "unreviewed"]));
}

export function filterRowsByReviewStatus(
  rows: readonly NoticeRow[],
  reviewState: ReadonlyMap<string, ReviewStatus>,
  filter: ReviewStatusFilter
): NoticeRow[] {
  if (filter === "all") {
    return [...rows];
  }

  return rows.filter((row) => (reviewState.get(row["공고번호"]) ?? "unreviewed") === filter);
}

export function getReviewStatusLabel(status: ReviewStatus): string {
  return reviewStatuses.find((item) => item.value === status)?.label ?? "미검토";
}

export function parseTagInput(value: string): string[] {
  const seen = new Set<string>();
  for (const tag of value.split(/[,\s/]+/).map((item) => item.trim()).filter(Boolean)) {
    seen.add(tag);
  }
  return [...seen];
}

export function serializeNoticeMetadata(metadata: ReadonlyMap<string, NoticeMetadata>): string {
  return JSON.stringify([...metadata.entries()]);
}

export function deserializeNoticeMetadata(value: string | undefined | null): Map<string, NoticeMetadata> {
  if (!value) {
    return new Map();
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return new Map();
    }

    const entries = parsed.flatMap((entry): [string, NoticeMetadata][] => {
      if (!Array.isArray(entry) || typeof entry[0] !== "string" || typeof entry[1] !== "object" || entry[1] === null) {
        return [];
      }

      const metadata = entry[1] as Partial<NoticeMetadata>;
      return [
        [
          entry[0],
          {
            memo: typeof metadata.memo === "string" ? metadata.memo : "",
            tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === "string") : []
          }
        ]
      ];
    });

    return new Map(entries);
  } catch {
    return new Map();
  }
}

export function buildDeadlineBadge(deadline: string | undefined, baseDate = new Date()): DeadlineBadge {
  if (!deadline) {
    return { label: "마감일 없음", tone: "muted" };
  }

  const deadlineDate = parseDate(deadline);
  if (!deadlineDate) {
    return { label: "마감일 없음", tone: "muted" };
  }

  const current = toKoreanDateParts(baseDate);
  const currentDate = new Date(Date.UTC(current.year, current.month - 1, current.day));
  const days = Math.round((deadlineDate.getTime() - currentDate.getTime()) / 86_400_000);

  if (days < 0) {
    return { label: "마감 지남", tone: "muted" };
  }

  if (days === 0) {
    return { label: "오늘 마감", tone: "urgent" };
  }

  return { label: `D-${days}`, tone: "normal" };
}

export function resolveSearchPreset(id: SearchPresetId, baseDate = new Date()): {
  from: string;
  to: string;
  keyword: string;
} {
  const current = toKoreanDateParts(baseDate);
  const to = formatDateParts(current);

  if (id === "thisMonth") {
    return { from: `${current.year}-${pad2(current.month)}-01`, to, keyword: "" };
  }

  if (id === "welfareCenter") {
    return { from: addDays(current, -30), to, keyword: "행정복지센터" };
  }

  return { from: addDays(current, -6), to, keyword: "" };
}

export function filterAndSortRows(
  rows: readonly NoticeRow[],
  notices: readonly NormalizedNotice[],
  filters: WorkspaceFilters
): NoticeRow[] {
  const noticeById = new Map(notices.map((notice) => [notice.noticeId, notice]));
  const filtered = filters.type === "all" ? [...rows] : rows.filter((row) => noticeById.get(row["공고번호"])?.noticeType === filters.type);

  return filtered.sort((left, right) => {
    const leftNotice = noticeById.get(left["공고번호"]);
    const rightNotice = noticeById.get(right["공고번호"]);

    if (filters.sort === "deadlineAsc") {
      return compareText(leftNotice?.deadline ?? left["마감일"], rightNotice?.deadline ?? right["마감일"]) || compareText(left["공고번호"], right["공고번호"]);
    }

    if (filters.sort === "budgetDesc") {
      return (rightNotice?.budget ?? parseBudget(right["예산"])) - (leftNotice?.budget ?? parseBudget(left["예산"])) || compareText(left["공고번호"], right["공고번호"]);
    }

    return compareText(left["공고번호"], right["공고번호"]);
  });
}

export function summarizeRows(rows: readonly NoticeRow[]): WorkspaceSummary {
  return {
    total: rows.length,
    construction: rows.filter((row) => row["구분"] === "공사").length,
    goods: rows.filter((row) => row["구분"] === "물품").length,
    service: rows.filter((row) => row["구분"] === "용역").length,
    domestic: rows.filter((row) => row["구분"] === "내자").length
  };
}

export function getExportNotices(notices: readonly NormalizedNotice[], selectedNoticeIds: ReadonlySet<string>): NormalizedNotice[] {
  if (selectedNoticeIds.size === 0) {
    return [...notices];
  }

  return notices.filter((notice) => selectedNoticeIds.has(notice.noticeId));
}

export function buildStatus(reason: StatusReason, count = 0): WorkspaceStatus {
  switch (reason) {
    case "sample-loaded":
      return { kind: "info", message: `샘플 공고 ${count}건을 불러왔습니다.` };
    case "collect-loaded":
      return { kind: "info", message: `API 수집 결과 ${count}건을 불러왔습니다.` };
    case "empty-result":
      return { kind: "warning", message: "수집 결과가 없습니다. 조회 기간, 키워드, API 활용 승인 상태를 확인하세요." };
    case "missing-api-key":
      return { kind: "warning", message: "API 키를 입력하거나 NARA_API_KEY 환경변수를 설정하세요." };
    case "missing-document":
      return { kind: "warning", message: "공고문 첨부 링크가 없는 공고입니다." };
    case "export-empty":
      return { kind: "warning", message: "먼저 샘플 데이터 또는 API 수집 결과를 불러오세요." };
  }
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "ko");
}

function parseBudget(value: string): number {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: string): Date | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return undefined;
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function toKoreanDateParts(date: Date): { year: number; month: number; day: number } {
  const koreanTime = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: koreanTime.getUTCFullYear(),
    month: koreanTime.getUTCMonth() + 1,
    day: koreanTime.getUTCDate()
  };
}

function addDays(parts: { year: number; month: number; day: number }, days: number): string {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return formatDateParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  });
}

function formatDateParts(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
