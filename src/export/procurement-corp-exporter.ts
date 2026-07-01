import writeXlsxFile, { type Feature, type Row } from "write-excel-file/node";
import type Stream from "node:stream";
import type { Blob } from "node:buffer";
import type { ProcurementCorpRow } from "../nara/procurement-corp-client.js";

export type ProcurementCorpExportRow = {
  "번호": number;
  "사업자등록번호": string;
  "업체명": string;
  "대표자명": string;
  "주소": string;
  "상세주소": string;
  "지역명": string;
  "업종/업무구분": string;
  "업종상세": string;
  "전화번호": string;
  "팩스번호": string;
  "홈페이지주소": string;
};

export const PROCUREMENT_CORP_EXPORT_COLUMNS = [
  "번호",
  "사업자등록번호",
  "업체명",
  "대표자명",
  "주소",
  "상세주소",
  "지역명",
  "업종/업무구분",
  "업종상세",
  "전화번호",
  "팩스번호",
  "홈페이지주소"
] as const satisfies readonly (keyof ProcurementCorpExportRow)[];

const COLUMN_WIDTHS = [10, 18, 24, 16, 34, 28, 22, 18, 36, 18, 18, 28];
type ExcelFileContent = Stream | Buffer | Blob;

export function buildProcurementCorpExportRows(rows: ProcurementCorpRow[]): ProcurementCorpExportRow[] {
  return rows.map((row, index) => ({
    "번호": index + 1,
    "사업자등록번호": row["사업자등록번호"],
    "업체명": row["업체명"],
    "대표자명": row["대표자명"],
    "주소": row["주소"],
    "상세주소": row["상세주소"],
    "지역명": row["지역명"],
    "업종/업무구분": row["업종/업무구분"],
    "업종상세": row["업종상세"],
    "전화번호": row["전화번호"],
    "팩스번호": row["팩스번호"],
    "홈페이지주소": row["홈페이지주소"]
  }));
}

export function exportProcurementCorpsToCsv(rows: ProcurementCorpRow[]): string {
  const exportRows = buildProcurementCorpExportRows(rows);
  return [
    PROCUREMENT_CORP_EXPORT_COLUMNS.join(","),
    ...exportRows.map((row) =>
      PROCUREMENT_CORP_EXPORT_COLUMNS.map((column) => escapeCsvValue(row[column])).join(",")
    )
  ].join("\n");
}

export async function exportProcurementCorpsToExcelBuffer(rows: ProcurementCorpRow[]): Promise<Buffer> {
  const exportRows = buildProcurementCorpExportRows(rows);
  const sheetData: Row[] = [
    PROCUREMENT_CORP_EXPORT_COLUMNS.map((column) => ({
      value: column,
      type: String,
      fontWeight: "bold",
      backgroundColor: "#EAF2F8"
    })),
    ...exportRows.map(rowToSheetRow)
  ];

  return writeXlsxFile(
    sheetData,
    {
      sheet: "procurement-corps",
      stickyRowsCount: 1,
      columns: COLUMN_WIDTHS.map((width) => ({ width }))
    },
    {
      features: [createAutoFilterFeature(sheetData.length)]
    }
  ).toBuffer();
}

function rowToSheetRow(row: ProcurementCorpExportRow): Row {
  return PROCUREMENT_CORP_EXPORT_COLUMNS.map((column) => {
    const value = row[column];
    if (column === "번호" && typeof value === "number") {
      return { value, type: Number, format: "#,##0" };
    }
    return { value: String(value), type: String };
  });
}

function createAutoFilterFeature(rowCount: number): Feature<ExcelFileContent> {
  return {
    files: {
      transform: {
        "xl/worksheets/sheet{id}.xml": {
          transform(content) {
            if (content.includes("<autoFilter")) {
              return content;
            }

            const autoFilter = `<autoFilter ref="A1:L${rowCount}"/>`;
            return content.replace("</sheetData>", `</sheetData>${autoFilter}`);
          }
        }
      }
    }
  };
}

function escapeCsvValue(value: ProcurementCorpExportRow[keyof ProcurementCorpExportRow]): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}
