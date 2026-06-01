import { Download, ExternalLink, FileSpreadsheet, Loader2, Search, TableProperties } from "lucide-react";
import { useMemo, useState } from "react";

type NoticeRow = {
  "No.": number;
  "공고번호": string;
  "공고명": string;
  "구분": string;
  "기관명": string;
  "지역": string;
  "예산": string;
  "마감일": string;
  "업종제한": string;
  "원문링크": string;
};

type NormalizedNotice = {
  noticeId: string;
  title: string;
  noticeType: "construction" | "goods" | "service" | "domestic";
  agency: string;
  region?: string;
  budget?: number;
  deadline?: string;
  industryRestriction?: string;
  sourceUrl?: string;
  raw?: Record<string, unknown>;
};

type NoticePayload = {
  rows: NoticeRow[];
  notices: NormalizedNotice[];
};

type ViewerUrlPayload = {
  mode: "synap" | "source";
  viewerUrl: string;
  message?: string;
};

const columns: (keyof NoticeRow)[] = [
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
];

const tableColumns = [...columns, "공고문"] as const;

export function App() {
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [notices, setNotices] = useState<NormalizedNotice[]>([]);
  const [from, setFrom] = useState("2026-05-01");
  const [to, setTo] = useState("2026-05-31");
  const [keyword, setKeyword] = useState("행정복지센터");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");

  const summary = useMemo(() => {
    const construction = rows.filter((row) => row["구분"] === "공사").length;
    const goods = rows.filter((row) => row["구분"] === "물품").length;
    const service = rows.filter((row) => row["구분"] === "용역").length;
    const domestic = rows.filter((row) => row["구분"] === "내자").length;
    return { total: rows.length, construction, goods, service, domestic };
  }, [rows]);

  async function loadSample() {
    setLoading("sample");
    setError("");
    try {
      applyPayload(await fetchJson<NoticePayload>("/api/sample-notices"));
    } catch (error) {
      setError(toErrorMessage(error));
    } finally {
      setLoading("");
    }
  }

  async function collectNotices() {
    setLoading("collect");
    setError("");
    try {
      const payload = await fetchJson<NoticePayload>("/api/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to, keyword, apiKey })
      });
      applyPayload(payload);
      if (payload.rows.length === 0) {
        setError("수집 결과가 없습니다. 조회 기간, 키워드, API 활용 승인 상태를 확인하세요.");
      }
    } catch (error) {
      setError(toErrorMessage(error));
    } finally {
      setLoading("");
    }
  }

  async function download(format: "csv" | "xlsx") {
    if (notices.length === 0) {
      setError("먼저 샘플 데이터 또는 API 수집 결과를 불러오세요.");
      return;
    }

    setLoading(format);
    setError("");
    try {
      const response = await fetch(`/api/export?format=${format}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notices })
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `nara-notices.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setError(toErrorMessage(error));
    } finally {
      setLoading("");
    }
  }

  async function openNoticeDocument(row: NoticeRow) {
    if (!row["원문링크"]) {
      setError("원문링크가 없는 공고입니다.");
      return;
    }

    setError("");
    try {
      const payload = await fetchJson<ViewerUrlPayload>(
        `/api/viewer-url?url=${encodeURIComponent(row["원문링크"])}&title=${encodeURIComponent(row["공고명"])}`
      );
      window.open(payload.viewerUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setError(toErrorMessage(error));
    }
  }

  function applyPayload(payload: NoticePayload) {
    setRows(payload.rows);
    setNotices(payload.notices);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>nara-notice-collector</h1>
          <p>나라장터 공고 검토 테이블</p>
        </div>
        <div className="topbar-actions">
          <button className="primary" type="button" onClick={loadSample} disabled={loading !== ""}>
            {loading === "sample" ? <Loader2 className="spin" size={18} /> : <TableProperties size={18} />}
            샘플 데이터
          </button>
          <button type="button" onClick={() => download("csv")} disabled={loading !== "" || notices.length === 0}>
            <Download size={18} />
            CSV
          </button>
          <button type="button" onClick={() => download("xlsx")} disabled={loading !== "" || notices.length === 0}>
            <FileSpreadsheet size={18} />
            Excel
          </button>
        </div>
      </header>

      <section className="controls" aria-label="API 수집">
        <label>
          시작일
          <input value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          종료일
          <input value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label>
          키워드
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        </label>
        <label className="api-key">
          API 키
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            type="password"
            autoComplete="off"
          />
        </label>
        <button className="primary" type="button" onClick={collectNotices} disabled={loading !== ""}>
          {loading === "collect" ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
          API 수집
        </button>
      </section>

      {error ? <div className="error">{error}</div> : null}

      <section className="summary" aria-label="요약">
        <div>
          <span>전체</span>
          <strong>{summary.total}</strong>
        </div>
        <div>
          <span>공사</span>
          <strong>{summary.construction}</strong>
        </div>
        <div>
          <span>물품</span>
          <strong>{summary.goods}</strong>
        </div>
        <div>
          <span>용역</span>
          <strong>{summary.service}</strong>
        </div>
        <div>
          <span>내자</span>
          <strong>{summary.domestic}</strong>
        </div>
      </section>

      <section className="table-wrap" aria-label="공고 목록">
        <table>
          <thead>
            <tr>
              {tableColumns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="empty" colSpan={tableColumns.length}>
                  표시할 공고가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row["공고번호"]}>
                  {columns.map((column) => (
                    <td key={column} className={column === "공고명" || column === "원문링크" ? "wide" : undefined}>
                      {row[column]}
                    </td>
                  ))}
                  <td>
                    <button
                      className="compact"
                      type="button"
                      onClick={() => void openNoticeDocument(row)}
                      disabled={!row["원문링크"]}
                      title="Synap 설정이 있으면 Synap 뷰어로 열고, 없으면 원문 링크를 엽니다."
                    >
                      <ExternalLink size={16} />
                      보기
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<T>;
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
