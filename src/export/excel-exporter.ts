import writeXlsxFile, { type Feature, type Row } from "write-excel-file/node";
import type Stream from "node:stream";
import type { Blob } from "node:buffer";
import { buildNoticeExportRows, EXPORT_COLUMNS } from "./csv-exporter.js";
import type { NormalizedNotice, NoticeExportRow } from "../nara/types.js";

const COLUMN_WIDTHS = [12, 16, 42, 12, 24, 18, 16, 22, 24, 42];
type ExcelFileContent = Stream | Buffer | Blob;

export async function exportNoticesToExcel(notices: NormalizedNotice[], outputPath: string): Promise<void> {
  await createExcelWriter(notices).toFile(outputPath);
}

export async function exportNoticesToExcelBuffer(notices: NormalizedNotice[]): Promise<Buffer> {
  return createExcelWriter(notices).toBuffer();
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

function createAutoFilterFeature(rowCount: number): Feature<ExcelFileContent> {
  return {
    files: {
      transform: {
        "xl/worksheets/sheet{id}.xml": {
          transform(content) {
            if (content.includes("<autoFilter")) {
              return content;
            }

            const autoFilter = `<autoFilter ref="A1:J${rowCount}"/>`;
            return content.replace("</sheetData>", `</sheetData>${autoFilter}`);
          }
        }
      }
    }
  };
}
