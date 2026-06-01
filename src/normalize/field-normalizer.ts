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
    const [, year, month, day, hour, minute, second = "00"] = dateTime;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

export function normalizeIndustryRestriction(raw: Record<string, unknown>): string | undefined {
  const explicitName = normalizeText(raw.indstrytyLmtNm);
  if (explicitName) {
    return explicitName;
  }

  const hasRestriction = normalizeText(raw.indstrytyLmtYn)?.toUpperCase();
  if (hasRestriction === "Y") {
    return "제한있음";
  }

  return undefined;
}
