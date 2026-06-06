import writeXlsxFile, { type Feature, type Row } from "write-excel-file/node";
import type Stream from "node:stream";
import type { Blob } from "node:buffer";
import { buildNoticeExportRows, EXPORT_COLUMNS } from "./csv-exporter.js";
import type { NormalizedNotice, NoticeExportRow } from "../nara/types.js";
import type { RawProcurementCorp } from "../nara/procurement-corp-client.js";

const COLUMN_WIDTHS = [12, 16, 42, 12, 24, 16, 22, 34, 42];
const EMAIL_EXPORT_COLUMNS = ["업체명", "이메일", "사업자등록번호", "홈페이지주소", "이메일출처"] as const;
const EMAIL_COLUMN_WIDTHS = [34, 42, 18, 42, 42];
type ExcelFileContent = Stream | Buffer | Blob;

export async function exportNoticesToExcel(notices: NormalizedNotice[], outputPath: string): Promise<void> {
  await createExcelWriter(notices).toFile(outputPath);
}

export async function exportNoticesToExcelBuffer(notices: NormalizedNotice[]): Promise<Buffer> {
  return createExcelWriter(notices).toBuffer();
}

export async function exportEmailResultsToExcelBuffer(corporations: RawProcurementCorp[]): Promise<Buffer> {
  const sheetData: Row[] = [
    EMAIL_EXPORT_COLUMNS.map((column) => ({
      value: column,
      type: String,
      fontWeight: "bold",
      backgroundColor: "#EAF2F8"
    })),
    ...corporations.map((corporation) =>
      EMAIL_EXPORT_COLUMNS.map((column) => ({
        value: readEmailExportValue(corporation, column),
        type: String
      }))
    )
  ];

  return writeXlsxFile(
    sheetData,
    {
      sheet: "emails",
      stickyRowsCount: 1,
      columns: EMAIL_COLUMN_WIDTHS.map((width) => ({ width }))
    },
    {
      features: [createAutoFilterFeature(sheetData.length, EMAIL_EXPORT_COLUMNS.length)]
    }
  ).toBuffer();
}

function createExcelWriter(notices: NormalizedNotice[]) {
  const rows = buildNoticeExportRows(notices);
  const sheetData: Row[] = [
    EXPORT_COLUMNS.map((column) => ({
      value: column,
      type: String,
      fontWeight: "bold",
      backgroundColor: "#EAF2F8"
    })),
    ...rows.map(rowToSheetRow)
  ];

  return writeXlsxFile(
    sheetData,
    {
      sheet: "notices",
      stickyRowsCount: 1,
      columns: COLUMN_WIDTHS.map((width) => ({ width }))
    },
    {
      features: [createAutoFilterFeature(sheetData.length)]
    }
  );
}

function rowToSheetRow(row: NoticeExportRow): Row {
  return EXPORT_COLUMNS.map((column) => {
    const value = row[column];
    if (column === "No." && typeof value === "number") {
      return { value, type: Number, format: "#,##0" };
    }

    if (column === "예산" && typeof value === "string" && value) {
      return { value: Number(value.replaceAll(",", "")), type: Number, format: "#,##0" };
    }

    return { value: String(value), type: String };
  });
}

function readEmailExportValue(corporation: RawProcurementCorp, column: (typeof EMAIL_EXPORT_COLUMNS)[number]): string {
  if (column === "업체명") {
    return corporation.corpNm ?? "";
  }
  if (column === "이메일") {
    return corporation.emailAddresses ?? "";
  }
  if (column === "사업자등록번호") {
    return corporation.bizno ?? "";
  }
  if (column === "홈페이지주소") {
    return corporation.hmpgAdrs ?? "";
  }
  return corporation.emailSourceUrl ?? "";
}

function createAutoFilterFeature(rowCount: number, columnCount: number = EXPORT_COLUMNS.length): Feature<ExcelFileContent> {
  return {
    files: {
      transform: {
        "xl/worksheets/sheet{id}.xml": {
          transform(content) {
            if (content.includes("<autoFilter")) {
              return content;
            }

            const autoFilter = `<autoFilter ref="A1:${columnIndexToName(columnCount)}${rowCount}"/>`;
            return content.replace("</sheetData>", `</sheetData>${autoFilter}`);
          }
        }
      }
    }
  };
}

function columnIndexToName(columnCount: number): string {
  let value = Math.max(1, Math.floor(columnCount));
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}
