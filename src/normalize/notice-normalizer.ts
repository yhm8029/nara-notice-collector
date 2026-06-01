import type { NormalizedNotice, RawNaraNotice } from "../nara/types.js";
import {
  normalizeDate,
  normalizeIndustryRestriction,
  normalizeMoney,
  normalizeText
} from "./field-normalizer.js";

export function normalizeNotice(raw: RawNaraNotice): NormalizedNotice {
  return {
    dDay: "확인필요",
    noticeId: normalizeText(raw.bidNtceNo) ?? "",
    title: normalizeText(raw.bidNtceNm) ?? "",
    noticeType: "unknown",
    agency: normalizeText(raw.ntceInsttNm) ?? "",
    region: normalizeText(raw.regionNm),
    budget: normalizeMoney(raw.presmptPrce ?? raw.asignBdgtAmt),
    deadline: normalizeDate(raw.bidClseDt),
    industryRestriction: normalizeIndustryRestriction(raw),
    sourceUrl: normalizeText(raw.sourceUrl),
    raw
  };
}

export function normalizeNotices(rawNotices: RawNaraNotice[]): NormalizedNotice[] {
  return rawNotices.map((raw) => normalizeNotice(raw));
}
