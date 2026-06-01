import type { NormalizedNotice, RawNaraNotice } from "../nara/types.js";
import { classifyNoticeType } from "../classify/notice-type-classifier.js";
import {
  normalizeDate,
  normalizeIndustryRestriction,
  normalizeMoney,
  normalizeText
} from "./field-normalizer.js";

export type NormalizeNoticeOptions = {
  baseDate?: Date;
};

export function normalizeNotice(raw: RawNaraNotice, options: NormalizeNoticeOptions = {}): NormalizedNotice {
  const title = normalizeText(raw.bidNtceNm) ?? "";
  const deadline = normalizeDate(raw.bidClseDt);

  return {
    noticeId: normalizeText(raw.bidNtceNo) ?? "",
    title,
    noticeType: classifyNoticeType(raw),
    agency: normalizeText(raw.ntceInsttNm) ?? "",
    region: normalizeText(raw.regionNm),
    budget: normalizeMoney(raw.presmptPrce ?? raw.asignBdgtAmt),
    deadline,
    industryRestriction: normalizeIndustryRestriction(raw),
    sourceUrl: normalizeText(raw.sourceUrl),
    raw
  };
}

export function normalizeNotices(
  rawNotices: RawNaraNotice[],
  options: NormalizeNoticeOptions = {}
): NormalizedNotice[] {
  return rawNotices.map((raw) => normalizeNotice(raw, options));
}
