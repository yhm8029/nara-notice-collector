export type NoticeType = "construction" | "goods" | "service" | "unknown";

export type RawNaraNotice = Record<string, unknown> & {
  bidNtceNo?: string;
  bidNtceNm?: string;
  ntceInsttNm?: string;
  presmptPrce?: string;
  asignBdgtAmt?: string;
  bidClseDt?: string;
  indstrytyLmtYn?: string;
  indstrytyLmtNm?: string;
  regionNm?: string;
  sourceUrl?: string;
};

export type NormalizedNotice = {
  dDay: string;
  noticeId: string;
  title: string;
  noticeType: NoticeType;
  agency: string;
  region?: string;
  budget?: number;
  deadline?: string;
  industryRestriction?: string;
  sourceUrl?: string;
  raw?: Record<string, unknown>;
};

export type NoticeExportRow = {
  "D-Day": string;
  "공고번호": string;
  "공고명": string;
  "구분": string;
  "기관명": string;
  "지역": string;
  "예산": number | "";
  "마감일": string;
  "업종제한": string;
  "원문링크": string;
};
