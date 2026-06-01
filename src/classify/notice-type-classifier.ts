import type { NoticeType } from "../nara/types.js";

const CONSTRUCTION_KEYWORDS = [
  "공사",
  "개축",
  "증축",
  "신축",
  "보수",
  "리모델링",
  "전기공사",
  "기계설비공사",
  "정보통신공사"
];

const GOODS_KEYWORDS = [
  "구매",
  "제조",
  "납품",
  "물품",
  "장비",
  "기자재",
  "자재",
  "시스템 구입"
];

const SERVICE_KEYWORDS = [
  "용역",
  "설계",
  "감리",
  "조사",
  "점검",
  "유지관리",
  "위탁",
  "진단",
  "컨설팅"
];

export function classifyNoticeType(title: string | undefined): NoticeType {
  const normalizedTitle = title?.trim() ?? "";
  if (!normalizedTitle) {
    return "unknown";
  }

  if (containsAny(normalizedTitle, CONSTRUCTION_KEYWORDS)) {
    return "construction";
  }

  if (containsAny(normalizedTitle, GOODS_KEYWORDS)) {
    return "goods";
  }

  if (containsAny(normalizedTitle, SERVICE_KEYWORDS)) {
    return "service";
  }

  return "unknown";
}

export function noticeTypeToKorean(noticeType: NoticeType): string {
  switch (noticeType) {
    case "construction":
      return "공사";
    case "goods":
      return "물품";
    case "service":
      return "용역";
    case "unknown":
      return "미분류";
  }
}

function containsAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}
