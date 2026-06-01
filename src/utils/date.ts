const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function extractDateParts(value: string | undefined): { year: number; month: number; day: number } | undefined {
  if (!value) {
    return undefined;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  const dateParts = {
    year: Number(year),
    month: Number(month),
    day: Number(day)
  };

  if (!isValidDateParts(dateParts.year, dateParts.month, dateParts.day)) {
    return undefined;
  }

  return dateParts;
}

export function dateToUtcDay(value: string | undefined): number | undefined {
  const parts = extractDateParts(value);
  if (!parts) {
    return undefined;
  }

  return Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY;
}

export function baseDateToUtcDay(baseDate: Date): number {
  return Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()) / MS_PER_DAY;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
