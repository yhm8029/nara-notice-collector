export type NoticeType = "construction" | "goods" | "service" | "domestic";

export type RawNaraNotice = Record<string, unknown> & {
  bidNtceNo?: string;
  bidNtceNm?: string;
  bsnsDivNm?: string;
  noticeTypeHint?: NoticeType;
  ntceInsttNm?: string;
  presmptPrce?: string;
  asignBdgtAmt?: string;
  bidClseDt?: string;
  indstrytyLmtYn?: string;
  indstrytyLmtNm?: string;
  regionNm?: string;
  sourceUrl?: string;
  bidNtceDtlUrl?: string;
  bidNtceUrl?: string;
  stdNtceDocUrl?: string;
  sucsfbidCorpBizno?: string;
  sucsfbidCorpNm?: string;
  sucsfbidCorpTelNo?: string;
};

export type NoticeWinner = {
  companyName?: string;
  businessNumber?: string;
  phoneNumber?: string;
};

export type NormalizedNotice = {
  noticeId: string;
  title: string;
  noticeType: NoticeType;
  agency: string;
  region?: string;
  budget?: number;
  deadline?: string;
  industryRestriction?: string;
  sourceUrl?: string;
  documentUrl?: string;
  winner?: NoticeWinner;
  raw?: Record<string, unknown>;
};

export type NoticeExportRow = {
  "No.": number;
  "공고번호": string;
  "공고명": string;
  "구분": string;
  "기관명": string;
  "예산": string;
  "마감일": string;
  "업종제한": string;
  "낙찰자": string;
  "낙찰자 연락처": string;
  "원문링크": string;
};
