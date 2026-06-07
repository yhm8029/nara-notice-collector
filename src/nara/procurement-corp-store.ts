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

export type ProcurementCorpCollectionProgress = {
  completed: boolean;
  inqryDiv: string;
  nextPage: number;
  rangeFrom: string;
  rangeTo: string;
};

export type ProcurementCorpEmailResult = {
  bizno: string;
  emails: string[];
  sourceUrl: string;
  status: string;
};

export class ProcurementCorpStore {
  private readonly db: SqliteDatabase | undefined;
  private readonly memoryProgress = new Map<string, ProcurementCorpCollectionProgress>();
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
        this.memoryRows.set(item.bizno, { ...this.memoryRows.get(item.bizno), ...item });
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
        industry_detail_summary = CASE
          WHEN excluded.industry_detail_summary <> '' THEN excluded.industry_detail_summary
          ELSE procurement_corps.industry_detail_summary
        END,
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
          hmpg_adrs AS hmpgAdrs,
          email_addresses AS emailAddresses,
          email_source_url AS emailSourceUrl,
          email_status AS emailStatus,
          email_checked_at AS emailCheckedAt
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

  listEmailCrawlTargets(
    limit = 50,
    options: { excludedBusinessNumbers?: Set<string>; retryFailed?: boolean } = {}
  ): RawProcurementCorp[] {
    const resolvedLimit = Math.max(1, Math.floor(limit));
    const shouldIncludeTarget = (item: RawProcurementCorp) =>
      !options.excludedBusinessNumbers?.has(item.bizno ?? "") &&
      (options.retryFailed ? item.emailStatus !== "found" && item.emailStatus !== "not_found" : !item.emailStatus?.trim());
    if (!this.db) {
      return [...this.memoryRows.values()]
        .filter((item) => Boolean(item.industryDetailSummary?.trim()))
        .filter((item) => Boolean(item.hmpgAdrs?.trim()))
        .filter(shouldIncludeTarget)
        .sort((left, right) => (left.bizno ?? "").localeCompare(right.bizno ?? ""))
        .slice(0, resolvedLimit);
    }

    const statusCondition = options.retryFailed
      ? "COALESCE(email_status, '') = 'failed'"
      : "TRIM(COALESCE(email_status, '')) = ''";
    const excludedBusinessNumbers = [...(options.excludedBusinessNumbers ?? new Set<string>())];
    const excludedCondition =
      excludedBusinessNumbers.length > 0
        ? `AND bizno NOT IN (${excludedBusinessNumbers.map(() => "?").join(", ")})`
        : "";

    return this.db
      .prepare(
        `
        SELECT
          bizno,
          corp_nm AS corpNm,
          industry_detail_summary AS industryDetailSummary,
          hmpg_adrs AS hmpgAdrs,
          email_addresses AS emailAddresses,
          email_source_url AS emailSourceUrl,
          email_status AS emailStatus,
          email_checked_at AS emailCheckedAt
        FROM procurement_corps
        WHERE TRIM(industry_detail_summary) <> ''
          AND TRIM(hmpg_adrs) <> ''
          AND ${statusCondition}
          ${excludedCondition}
        ORDER BY bizno
        LIMIT ?
      `
      )
      .all(...excludedBusinessNumbers, resolvedLimit) as RawProcurementCorp[];
  }

  listEmailExportRows(): RawProcurementCorp[] {
    if (!this.db) {
      return [...this.memoryRows.values()]
        .filter((item) => Boolean(item.emailAddresses?.trim()))
        .sort((left, right) => (left.corpNm ?? "").localeCompare(right.corpNm ?? ""));
    }

    return this.db
      .prepare(
        `
        SELECT
          bizno,
          corp_nm AS corpNm,
          hmpg_adrs AS hmpgAdrs,
          email_addresses AS emailAddresses,
          email_source_url AS emailSourceUrl,
          email_status AS emailStatus,
          email_checked_at AS emailCheckedAt
        FROM procurement_corps
        WHERE TRIM(email_addresses) <> ''
        ORDER BY corp_nm, bizno
      `
      )
      .all() as RawProcurementCorp[];
  }

  updateEmailResult(result: ProcurementCorpEmailResult): void {
    const emailAddresses = result.emails.join(", ");
    const checkedAt = new Date().toISOString();
    if (!this.db) {
      const current = this.memoryRows.get(result.bizno);
      if (!current) {
        return;
      }
      this.memoryRows.set(result.bizno, {
        ...current,
        emailAddresses,
        emailCheckedAt: checkedAt,
        emailSourceUrl: result.sourceUrl,
        emailStatus: result.status
      });
      return;
    }

    this.db
      .prepare(
        `
        UPDATE procurement_corps
        SET
          email_addresses = ?,
          email_source_url = ?,
          email_status = ?,
          email_checked_at = ?
        WHERE bizno = ?
      `
      )
      .run(emailAddresses, result.sourceUrl, result.status, checkedAt, result.bizno);
  }

  getCollectionProgress(input: {
    inqryDiv: string;
    rangeFrom: string;
    rangeTo: string;
  }): ProcurementCorpCollectionProgress | undefined {
    if (!this.db) {
      return this.memoryProgress.get(toProgressKey(input));
    }

    const row = this.db
      .prepare(
        `
        SELECT
          inqry_div AS inqryDiv,
          range_from AS rangeFrom,
          range_to AS rangeTo,
          next_page AS nextPage,
          completed
        FROM procurement_corp_collection_progress
        WHERE inqry_div = ? AND range_from = ? AND range_to = ?
      `
      )
      .get(input.inqryDiv, input.rangeFrom, input.rangeTo) as
      | {
          completed: number;
          inqryDiv: string;
          nextPage: number;
          rangeFrom: string;
          rangeTo: string;
        }
      | undefined;

    return row
      ? {
          completed: Boolean(row.completed),
          inqryDiv: row.inqryDiv,
          nextPage: row.nextPage,
          rangeFrom: row.rangeFrom,
          rangeTo: row.rangeTo
        }
      : undefined;
  }

  upsertCollectionProgress(progress: ProcurementCorpCollectionProgress): void {
    const normalizedProgress = {
      ...progress,
      nextPage: Math.max(1, Math.floor(progress.nextPage))
    };
    if (!this.db) {
      this.memoryProgress.set(toProgressKey(normalizedProgress), normalizedProgress);
      return;
    }

    this.db
      .prepare(
        `
        INSERT INTO procurement_corp_collection_progress (
          inqry_div,
          range_from,
          range_to,
          next_page,
          completed,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(inqry_div, range_from, range_to) DO UPDATE SET
          next_page = excluded.next_page,
          completed = excluded.completed,
          updated_at = CURRENT_TIMESTAMP
      `
      )
      .run(
        normalizedProgress.inqryDiv,
        normalizedProgress.rangeFrom,
        normalizedProgress.rangeTo,
        normalizedProgress.nextPage,
        normalizedProgress.completed ? 1 : 0
      );
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
        email_addresses TEXT NOT NULL DEFAULT '',
        email_source_url TEXT NOT NULL DEFAULT '',
        email_status TEXT NOT NULL DEFAULT '',
        email_checked_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_corp_nm ON procurement_corps(corp_nm);
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_rgn_nm ON procurement_corps(rgn_nm);
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_industry_detail_summary ON procurement_corps(industry_detail_summary);
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_hmpg_adrs ON procurement_corps(hmpg_adrs);
      CREATE INDEX IF NOT EXISTS idx_procurement_corps_updated_at ON procurement_corps(updated_at);
      CREATE TABLE IF NOT EXISTS procurement_corp_collection_progress (
        inqry_div TEXT NOT NULL,
        range_from TEXT NOT NULL,
        range_to TEXT NOT NULL,
        next_page INTEGER NOT NULL DEFAULT 1,
        completed INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (inqry_div, range_from, range_to)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_corp_collection_progress_completed
        ON procurement_corp_collection_progress(completed);
    `);
    this.addColumnIfMissing("procurement_corps", "industry_detail_summary", "TEXT NOT NULL DEFAULT ''");
    this.addColumnIfMissing("procurement_corps", "email_addresses", "TEXT NOT NULL DEFAULT ''");
    this.addColumnIfMissing("procurement_corps", "email_source_url", "TEXT NOT NULL DEFAULT ''");
    this.addColumnIfMissing("procurement_corps", "email_status", "TEXT NOT NULL DEFAULT ''");
    this.addColumnIfMissing("procurement_corps", "email_checked_at", "TEXT NOT NULL DEFAULT ''");
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

function toProgressKey(input: { inqryDiv: string; rangeFrom: string; rangeTo: string }): string {
  return `${input.inqryDiv}\u0000${input.rangeFrom}\u0000${input.rangeTo}`;
}
