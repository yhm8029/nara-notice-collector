import type { NoticeType, RawNaraNotice } from "../nara/types.js";

const API_BUSINESS_DIVISION_MAP = new Map<string, NoticeType>([
  ["공사", "construction"],
  ["물품", "goods"],
  ["용역", "service"],
  ["내자", "domestic"],
  ["외자", "domestic"]
]);

export function classifyNoticeType(raw: RawNaraNotice): NoticeType {
  const apiBusinessDivision = normalizeApiBusinessDivision(raw.bsnsDivNm);
  if (apiBusinessDivision) {
    return apiBusinessDivision;
  }

  return raw.noticeTypeHint ?? "domestic";
}

export function noticeTypeToKorean(noticeType: NoticeType): string {
  switch (noticeType) {
    case "construction":
      return "공사";
    case "goods":
      return "물품";
    case "service":
      return "용역";
    case "domestic":
      return "내자";
  }
}

function normalizeApiBusinessDivision(value: unknown): NoticeType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return API_BUSINESS_DIVISION_MAP.get(value.trim());
}
