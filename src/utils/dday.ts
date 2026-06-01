import { baseDateToUtcDay, dateToUtcDay } from "./date.js";

export function calculateDday(deadline: string | undefined, baseDate = new Date()): string {
  const deadlineDay = dateToUtcDay(deadline);
  if (deadlineDay === undefined) {
    return "확인필요";
  }

  const baseDay = baseDateToUtcDay(baseDate);
  const diff = deadlineDay - baseDay;

  if (diff === 0) {
    return "D-Day";
  }

  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
}
