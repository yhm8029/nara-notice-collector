import type { NormalizedNotice, NoticeWinner, RawNaraNotice } from "../nara/types.js";
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
    sourceUrl: normalizeNoticeSourceUrl(raw),
    documentUrl: normalizeNoticeDocumentUrl(raw),
    winner: normalizeNoticeWinner(raw),
    raw
  };
}

export function normalizeNotices(
  rawNotices: RawNaraNotice[],
  options: NormalizeNoticeOptions = {}
): NormalizedNotice[] {
  return rawNotices.map((raw) => normalizeNotice(raw, options));
}

function normalizeNoticeSourceUrl(raw: RawNaraNotice): string | undefined {
  return normalizeText(raw.sourceUrl) ?? normalizeText(raw.bidNtceDtlUrl) ?? normalizeText(raw.bidNtceUrl);
}

function normalizeNoticeWinner(raw: RawNaraNotice): NoticeWinner | undefined {
  const companyName = readFirstText(raw, [
    "sucsfbidCorpNm",
    "sucsfbidEntrpsNm",
    "sccssBidder",
    "cntrctEntrpsNm",
    "winnerCompanyName",
    "winnerCorpNm"
  ]);
  const businessNumber = normalizeBusinessNumber(
    readFirstText(raw, ["sucsfbidCorpBizno", "sucsfbidCorpBzno", "sucsfbidBizno", "winnerBusinessNumber", "bizno"])
  );
  const phoneNumber = readFirstText(raw, ["sucsfbidCorpTelNo", "sucsfbidTelNo", "winnerPhoneNumber", "telNo"]);

  if (!companyName && !businessNumber && !phoneNumber) {
    return undefined;
  }

  return {
    ...(companyName ? { companyName } : {}),
    ...(businessNumber ? { businessNumber } : {}),
    ...(phoneNumber ? { phoneNumber } : {})
  };
}

function readFirstText(raw: RawNaraNotice, fields: string[]): string | undefined {
  for (const field of fields) {
    const value = normalizeText(raw[field]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function normalizeBusinessNumber(value: string | undefined): string | undefined {
  const digits = value?.replace(/\D/g, "");
  return digits || undefined;
}

function normalizeNoticeDocumentUrl(raw: RawNaraNotice): string | undefined {
  const viewerUrl = normalizeNoticeViewerUrl(raw);
  if (viewerUrl) {
    return viewerUrl;
  }

  const standardNoticeUrl = normalizeText(raw.stdNtceDocUrl);
  if (standardNoticeUrl) {
    return standardNoticeUrl;
  }

  for (let index = 1; index <= 10; index += 1) {
    const fileName = normalizeText(raw[`ntceSpecFileNm${index}`]);
    const fileUrl = normalizeText(raw[`ntceSpecDocUrl${index}`]);
    if (fileName?.includes("공고문") && fileUrl) {
      return fileUrl;
    }
  }

  for (let index = 1; index <= 10; index += 1) {
    const fileUrl = normalizeText(raw[`ntceSpecDocUrl${index}`]);
    if (fileUrl) {
      return fileUrl;
    }
  }

  return undefined;
}

function normalizeNoticeViewerUrl(raw: RawNaraNotice): string | undefined {
  const directViewerFields = [
    "stdNtceDocViewUrl",
    "synapDocViewUrl",
    "docViewUrl",
    "viewerUrl",
    "noticeDocumentViewerUrl",
    "bidNtceDocViewUrl"
  ];

  for (const field of directViewerFields) {
    const url = normalizeText(raw[field]);
    if (url && isG2bSynapViewerUrl(url)) {
      return url;
    }
  }

  for (let index = 1; index <= 10; index += 1) {
    const url = normalizeText(raw[`ntceSpecDocViewUrl${index}`]);
    if (url && isG2bSynapViewerUrl(url)) {
      return url;
    }
  }

  for (const [field, value] of Object.entries(raw)) {
    if (!field.toLowerCase().includes("url")) {
      continue;
    }
    const url = normalizeText(value);
    if (url && isG2bSynapViewerUrl(url)) {
      return url;
    }
  }

  return undefined;
}

function isG2bSynapViewerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname.endsWith("g2b.go.kr") && url.pathname.includes("/SynapDocViewServer/viewer/doc.html");
  } catch {
    return false;
  }
}
