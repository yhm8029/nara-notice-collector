import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { toProcurementCorpRows, type ProcurementCorpRow, type RawProcurementCorp } from "./procurement-corp-client.js";

export type ProcurementCorpPage = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  rows: ProcurementCorpRow[];
};

export class ProcurementCorpStore {
  private readonly db: DatabaseSync;

  constructor(dbPath = resolve(process.cwd(), "output/procurement-corps.sqlite")) {
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initialize();
  }

  upsertMany(corporations: RawProcurementCorp[]): number {
    const statement = this.db.prepare(`
      INSERT INTO procurement_corps (
        bizno,
        corp_nm,
        ceo_nm,
        adrs,
        dtl_adrs,
        rgn_nm,
        corp_bsns_div_nm,
        tel_no,
        fax_no,
        hmpg_adrs,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(bizno) DO UPDATE SET
        corp_nm = excluded.corp_nm,
        ceo_nm = excluded.ceo_nm,
        adrs = excluded.adrs,
        dtl_adrs = excluded.dtl_adrs,
        rgn_nm = excluded.rgn_nm,
        corp_bsns_div_nm = excluded.corp_bsns_div_nm,
        tel_no = excluded.tel_no,
        fax_no = excluded.fax_no,
        hmpg_adrs = excluded.hmpg_adrs,
        updated_at = CURRENT_TIMESTAMP
    `);
    let count = 0;
    this.db.exec("BEGIN");
    try {
      for (const item of corporations) {
        if (!item.bizno) {
          continue;
        }
        statement.run(
          item.bizno,
          item.corpNm ?? "",
          item.ceoNm ?? "",
          item.adrs ?? "",
          item.dtlAdrs ?? "",
          item.rgnNm ?? "",
          item.corpBsnsDivNm ?? "",
          item.telNo ?? "",
          item.faxNo ?? "",
          item.hmpgAdrs ?? ""
        );
        count += 1;
      }
      this.db.exec("COMMIT");
      return count;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  listRows(options: { page?: number; pageSize?: number } = {}): ProcurementCorpPage {
    const pageSize = Math.max(1, Math.floor(options.pageSize ?? 20));
    const page = Math.max(1, Math.floor(options.page ?? 1));
    const offset = (page - 1) * pageSize;
    const totalCount = Number(
      (this.db.prepare("SELECT COUNT(*) AS count FROM procurement_corps").get() as { count: number }).count
    );
    const rows = this.db
      .prepare(
        `
        SELECT
          bizno,
          corp_nm AS corpNm,
          ceo_nm AS ceoNm,
          adrs,
          dtl_adrs AS dtlAdrs,
          rgn_nm AS rgnNm,
          corp_bsns_div_nm AS corpBsnsDivNm,
          tel_no AS telNo,
          fax_no AS faxNo,
          hmpg_adrs AS hmpgAdrs
        FROM procurement_corps
        ORDER BY bizno
        LIMIT ? OFFSET ?
      `
      )
      .all(pageSize, offset) as RawProcurementCorp[];

    return {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      rows: toProcurementCorpRows(rows).map((row, index) => ({
        ...row,
        "No.": offset + index + 1
      }))
    };
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS procurement_corps (
        bizno TEXT PRIMARY KEY,
        corp_nm TEXT NOT NULL DEFAULT '',
        ceo_nm TEXT NOT NULL DEFAULT '',
        adrs TEXT NOT NULL DEFAULT '',
        dtl_adrs TEXT NOT NULL DEFAULT '',
        rgn_nm TEXT NOT NULL DEFAULT '',
        corp_bsns_div_nm TEXT NOT NULL DEFAULT '',
        tel_no TEXT NOT NULL DEFAULT '',
        fax_no TEXT NOT NULL DEFAULT '',
        hmpg_adrs TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_corp_nm ON procurement_corps(corp_nm);
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_rgn_nm ON procurement_corps(rgn_nm);
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_updated_at ON procurement_corps(updated_at);
    `);
  }
}
