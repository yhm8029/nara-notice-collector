import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { toProcurementCorpRows, type ProcurementCorpRow, type RawProcurementCorp } from "./procurement-corp-client.js";

export type ProcurementCorpPage = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  rows: ProcurementCorpRow[];
};

export class ProcurementCorpStore {
  private readonly db: SqliteDatabase | undefined;
  private readonly memoryRows = new Map<string, RawProcurementCorp>();

  constructor(dbPath = resolve(process.cwd(), "output/procurement-corps.sqlite")) {
    const DatabaseSync = loadSqliteDatabaseSync();
    if (DatabaseSync && dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = DatabaseSync ? new DatabaseSync(dbPath) : undefined;
    this.initializeSqlite();
  }

  upsertMany(corporations: RawProcurementCorp[]): number {
    if (!this.db) {
      let count = 0;
      for (const item of corporations) {
        if (!item.bizno) {
          continue;
        }
        this.memoryRows.set(item.bizno, item);
        count += 1;
      }
      return count;
    }

    const statement = this.db.prepare(`
      INSERT INTO procurement_corps (
        bizno,
        corp_nm,
        ceo_nm,
        adrs,
        dtl_adrs,
        rgn_nm,
        corp_bsns_div_nm,
        industry_detail_summary,
        tel_no,
        fax_no,
        hmpg_adrs,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(bizno) DO UPDATE SET
        corp_nm = excluded.corp_nm,
        ceo_nm = excluded.ceo_nm,
        adrs = excluded.adrs,
        dtl_adrs = excluded.dtl_adrs,
        rgn_nm = excluded.rgn_nm,
        corp_bsns_div_nm = excluded.corp_bsns_div_nm,
        industry_detail_summary = excluded.industry_detail_summary,
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
          item.industryDetailSummary ?? "",
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

  listRows(
    options: { hasHomepage?: boolean; hasIndustryDetails?: boolean; page?: number; pageSize?: number } = {}
  ): ProcurementCorpPage {
    const pageSize = Math.max(1, Math.floor(options.pageSize ?? 20));
    const page = Math.max(1, Math.floor(options.page ?? 1));
    const offset = (page - 1) * pageSize;
    if (!this.db) {
      const corporations = [...this.memoryRows.values()]
        .filter((item) => !options.hasIndustryDetails || Boolean(item.industryDetailSummary?.trim()))
        .filter((item) => !options.hasHomepage || Boolean(item.hmpgAdrs?.trim()))
        .sort((left, right) => (left.bizno ?? "").localeCompare(right.bizno ?? ""));
      const totalCount = corporations.length;
      return {
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
        rows: toProcurementCorpRows(corporations.slice(offset, offset + pageSize)).map((row, index) => ({
          ...row,
          "No.": offset + index + 1
        }))
      };
    }

    const whereConditions = [
      options.hasIndustryDetails ? "TRIM(industry_detail_summary) <> ''" : undefined,
      options.hasHomepage ? "TRIM(hmpg_adrs) <> ''" : undefined
    ].filter((condition): condition is string => Boolean(condition));
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";
    const totalCount = Number(
      (this.db.prepare(`SELECT COUNT(*) AS count FROM procurement_corps ${whereClause}`).get() as { count: number })
        .count
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
          industry_detail_summary AS industryDetailSummary,
          tel_no AS telNo,
          fax_no AS faxNo,
          hmpg_adrs AS hmpgAdrs
        FROM procurement_corps
        ${whereClause}
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

  private initializeSqlite(): void {
    if (!this.db) {
      return;
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS procurement_corps (
        bizno TEXT PRIMARY KEY,
        corp_nm TEXT NOT NULL DEFAULT '',
        ceo_nm TEXT NOT NULL DEFAULT '',
        adrs TEXT NOT NULL DEFAULT '',
        dtl_adrs TEXT NOT NULL DEFAULT '',
        rgn_nm TEXT NOT NULL DEFAULT '',
        corp_bsns_div_nm TEXT NOT NULL DEFAULT '',
        industry_detail_summary TEXT NOT NULL DEFAULT '',
        tel_no TEXT NOT NULL DEFAULT '',
        fax_no TEXT NOT NULL DEFAULT '',
        hmpg_adrs TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_corp_nm ON procurement_corps(corp_nm);
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_rgn_nm ON procurement_corps(rgn_nm);
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_industry_detail_summary ON procurement_corps(industry_detail_summary);
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_hmpg_adrs ON procurement_corps(hmpg_adrs);
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_updated_at ON procurement_corps(updated_at);
    `);
    this.addColumnIfMissing("procurement_corps", "industry_detail_summary", "TEXT NOT NULL DEFAULT ''");
  }

  private addColumnIfMissing(tableName: string, columnName: string, definition: string): void {
    if (!this.db) {
      return;
    }

    const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as { name?: string }[];
    if (columns.some((column) => column.name === columnName)) {
      return;
    }

    this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
};

function loadSqliteDatabaseSync(): (new (path: string) => SqliteDatabase) | undefined {
  try {
    const require = createRequire(import.meta.url);
    return (require("node:sqlite") as { DatabaseSync: new (path: string) => SqliteDatabase }).DatabaseSync;
  } catch {
    return undefined;
  }
}
