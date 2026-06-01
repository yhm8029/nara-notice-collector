import { noticeTypeToKorean } from "../classify/notice-type-classifier.js";
import type { NormalizedNotice, NoticeExportRow } from "../nara/types.js";

export const EXPORT_COLUMNS = [
  "No.",
  "공고번호",
  "공고명",
  "구분",
  "기관명",
  "지역",
  "예산",
  "마감일",
  "업종제한",
  "원문링크"
] as const satisfies readonly (keyof NoticeExportRow)[];

export function buildNoticeExportRows(notices: NormalizedNotice[]): NoticeExportRow[] {
  return [...notices]
    .sort(compareNoticesForExport)
    .map((notice, index) => ({
      "No.": index + 1,
      "공고번호": notice.noticeId,
      "공고명": notice.title,
      "구분": noticeTypeToKorean(notice.noticeType),
      "기관명": notice.agency,
      "지역": notice.region ?? "",
      "예산": notice.budget ?? "",
      "마감일": notice.deadline ?? "",
      "업종제한": notice.industryRestriction ?? "",
      "원문링크": notice.sourceUrl ?? ""
    }));
}

export function exportNoticesToCsv(notices: NormalizedNotice[]): string {
  const rows = buildNoticeExportRows(notices);
  return [
    EXPORT_COLUMNS.join(","),
    ...rows.map((row) => EXPORT_COLUMNS.map((column) => escapeCsvValue(row[column])).join(","))
  ].join("\n");
}

function compareNoticesForExport(a: NormalizedNotice, b: NormalizedNotice): number {
  return (
    a.noticeId.localeCompare(b.noticeId, "ko") ||
    noticeTypeToKorean(a.noticeType).localeCompare(noticeTypeToKorean(b.noticeType), "ko")
  );
}

function escapeCsvValue(value: NoticeExportRow[keyof NoticeExportRow]): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}
