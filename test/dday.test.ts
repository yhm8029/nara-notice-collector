import { describe, expect, it } from "vitest";
import { calculateDday } from "../src/utils/dday.js";

describe("calculateDday", () => {
  const baseDate = new Date("2026-05-31");

  it("returns D-Day when the deadline date is today", () => {
    expect(calculateDday("2026-05-31", baseDate)).toBe("D-Day");
    expect(calculateDday("2026-05-31 10:00:00", baseDate)).toBe("D-Day");
  });

  it("returns D-n for future deadlines", () => {
    expect(calculateDday("2026-06-01", baseDate)).toBe("D-1");
    expect(calculateDday("2026-06-07", baseDate)).toBe("D-7");
  });

  it("returns D+n for past deadlines", () => {
    expect(calculateDday("2026-05-30", baseDate)).toBe("D+1");
  });

  it("returns 확인필요 for missing or invalid deadlines", () => {
    expect(calculateDday(undefined, baseDate)).toBe("확인필요");
    expect(calculateDday("not a date", baseDate)).toBe("확인필요");
  });

  it("handles ISO date-time strings by date unit", () => {
    expect(calculateDday("2026-06-01T23:30:00+09:00", baseDate)).toBe("D-1");
  });
});
