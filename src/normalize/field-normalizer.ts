export function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

export function normalizeMoney(value: unknown): number | undefined {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  const numericText = text.replaceAll(",", "");
  if (!/^\d+(\.\d+)?$/.test(numericText)) {
    return undefined;
  }

  const amount = Number(numericText);
  return Number.isFinite(amount) ? amount : undefined;
}

export function normalizeDate(value: unknown): string | undefined {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    return text;
  }

  const dateTime = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (dateTime) {
    const [, year, month, day, hour, minute] = dateTime;
    return formatKoreanDateTime(year, month, day, Number(hour), minute);
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return formatKstDateTime(parsed);
}

export function normalizeIndustryRestriction(raw: Record<string, unknown>): string | undefined {
  const restrictions: string[] = [];
  const industryNames = uniqueTexts(raw.indstrytyLmtNm, raw.indstrytyNm);
  if (industryNames.length > 0) {
    restrictions.push(`업종: ${industryNames.join(", ")}`);
  }

  const hasRestriction = normalizeText(raw.indstrytyLmtYn)?.toUpperCase();
  if (hasRestriction === "Y" && industryNames.length === 0) {
    restrictions.push("업종제한 있음");
  }

  const regionNames = uniqueTexts(raw.prtcptLmtRgnNm, raw.rgnLmtBidLocplcJdgmBssNm);
  if (regionNames.length > 0) {
    restrictions.push(`지역: ${regionNames.join(", ")}`);
  }

  if (normalizeText(raw.prdctClsfcLmtYn)?.toUpperCase() === "Y") {
    restrictions.push("물품분류제한 있음");
  }

  if (normalizeText(raw.bidPrtcptLmtYn)?.toUpperCase() === "Y") {
    restrictions.push("입찰참가제한 있음");
  }

  if (normalizeText(raw.cmmnSpldmdCorpRgnLmtYn)?.toUpperCase() === "Y") {
    restrictions.push("공동수급 지역제한 있음");
  }

  return restrictions.length > 0 ? restrictions.join(", ") : undefined;
}

function uniqueTexts(...values: unknown[]): string[] {
  return [...new Set(values.map((value) => normalizeText(value)).filter((value): value is string => Boolean(value)))];
}

function formatKstDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return formatKoreanDateTime(
    getPart("year"),
    getPart("month"),
    getPart("day"),
    Number(getPart("hour")),
    getPart("minute")
  );
}

function formatKoreanDateTime(year: string, month: string, day: string, hour24: number, minute: string): string {
  const period = hour24 < 12 ? "오전" : "오후";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${year}-${month}-${day} ${period} ${hour12}:${minute}`;
}
