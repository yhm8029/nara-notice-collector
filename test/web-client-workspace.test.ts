import { describe, expect, it } from "vitest";
import {
  buildStatus,
  buildDeadlineBadge,
  deserializeNoticeMetadata,
  filterRowsByReviewStatus,
  filterAndSortRows,
  getExportNotices,
  getInitialReviewState,
  parseTagInput,
  reviewStatuses,
  resolveSearchPreset,
  serializeNoticeMetadata,
  summarizeRows,
  type NormalizedNotice,
  type NoticeRow
} from "../src/web/client/notice-workspace.js";

const rows: NoticeRow[] = [
  row("20260500003", "용역", "2026-05-20", "55,000,000"),
  row("20260500001", "공사", "2026-05-10", "120,000,000"),
  row("20260500002", "물품", "2026-05-15", "80,000,000")
];

const notices: NormalizedNotice[] = [
  notice("20260500003", "service", "2026-05-20", 55000000),
  notice("20260500001", "construction", "2026-05-10", 120000000),
  notice("20260500002", "goods", "2026-05-15", 80000000)
];

describe("web workspace helpers", () => {
  it("resolves common search presets from a fixed base date", () => {
    expect(resolveSearchPreset("recent7Days", new Date("2026-06-02T00:00:00+09:00"))).toEqual({
      from: "2026-05-27",
      to: "2026-06-02",
      keyword: ""
    });

    expect(resolveSearchPreset("thisMonth", new Date("2026-06-02T00:00:00+09:00"))).toEqual({
      from: "2026-06-01",
      to: "2026-06-02",
      keyword: ""
    });

    expect(resolveSearchPreset("welfareCenter", new Date("2026-06-02T00:00:00+09:00")).keyword).toBe(
      "행정복지센터"
    );
  });

  it("filters by notice type and sorts by deadline or budget", () => {
    expect(filterAndSortRows(rows, notices, { type: "goods", sort: "deadlineAsc" }).map((item) => item["공고번호"])).toEqual([
      "20260500002"
    ]);

    expect(filterAndSortRows(rows, notices, { type: "all", sort: "deadlineAsc" }).map((item) => item["공고번호"])).toEqual([
      "20260500001",
      "20260500002",
      "20260500003"
    ]);

    expect(filterAndSortRows(rows, notices, { type: "all", sort: "budgetDesc" }).map((item) => item["공고번호"])).toEqual([
      "20260500001",
      "20260500002",
      "20260500003"
    ]);
  });

  it("summarizes the currently visible rows", () => {
    expect(summarizeRows(rows)).toEqual({
      total: 3,
      construction: 1,
      goods: 1,
      service: 1,
      domestic: 0
    });
  });

  it("exports selected notices when a selection exists and otherwise exports all notices", () => {
    expect(getExportNotices(notices, new Set(["20260500002"])).map((item) => item.noticeId)).toEqual(["20260500002"]);
    expect(getExportNotices(notices, new Set()).map((item) => item.noticeId)).toEqual([
      "20260500003",
      "20260500001",
      "20260500002"
    ]);
  });

  it("builds specific user-facing status messages", () => {
    expect(buildStatus("missing-api-key").message).toContain("API 키");
    expect(buildStatus("empty-result").message).toContain("수집 결과");
    expect(buildStatus("missing-document").message).toContain("공고문 첨부");
  });

  it("builds review status state and filters rows by status", () => {
    expect(reviewStatuses.map((status) => status.label)).toEqual(["미검토", "검토중", "관심", "제외"]);
    expect(getInitialReviewState(rows).get("20260500001")).toBe("unreviewed");

    const reviewState = new Map([
      ["20260500001", "reviewing"],
      ["20260500002", "interested"],
      ["20260500003", "excluded"]
    ] as const);

    expect(filterRowsByReviewStatus(rows, reviewState, "interested").map((item) => item["공고번호"])).toEqual([
      "20260500002"
    ]);
    expect(filterRowsByReviewStatus(rows, reviewState, "all")).toHaveLength(3);
  });

  it("parses tag input and serializes notice metadata", () => {
    expect(parseTagInput("전기, 시설 / 긴급  전기")).toEqual(["전기", "시설", "긴급"]);

    const serialized = serializeNoticeMetadata(
      new Map([
        [
          "20260500001",
          {
            memo: "현장 설명 확인 필요",
            tags: ["시설", "긴급"]
          }
        ]
      ])
    );

    expect(deserializeNoticeMetadata(serialized).get("20260500001")).toEqual({
      memo: "현장 설명 확인 필요",
      tags: ["시설", "긴급"]
    });
    expect(deserializeNoticeMetadata("not json")).toEqual(new Map());
  });

  it("builds deadline D-day badges", () => {
    const baseDate = new Date("2026-06-02T00:00:00+09:00");

    expect(buildDeadlineBadge("2026-06-05", baseDate)).toEqual({ label: "D-3", tone: "normal" });
    expect(buildDeadlineBadge("2026-06-02", baseDate)).toEqual({ label: "오늘 마감", tone: "urgent" });
    expect(buildDeadlineBadge("2026-06-01", baseDate)).toEqual({ label: "마감 지남", tone: "muted" });
    expect(buildDeadlineBadge(undefined, baseDate)).toEqual({ label: "마감일 없음", tone: "muted" });
  });
});

function row(id: string, type: string, deadline: string, budget: string): NoticeRow {
  return {
    "No.": Number(id.slice(-1)),
    공고번호: id,
    공고명: `${id} 공고`,
    구분: type,
    기관명: "테스트기관",
    예산: budget,
    마감일: deadline,
    업종제한: "",
    원문링크: `https://example.com/${id}`
  };
}

function notice(id: string, noticeType: NormalizedNotice["noticeType"], deadline: string, budget: number): NormalizedNotice {
  return {
    noticeId: id,
    title: `${id} 공고`,
    noticeType,
    agency: "테스트기관",
    deadline,
    budget,
    sourceUrl: `https://example.com/${id}`,
    documentUrl: `https://example.com/${id}/document`
  };
}
