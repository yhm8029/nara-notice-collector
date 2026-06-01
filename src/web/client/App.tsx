import { Download, FileSpreadsheet, Loader2, Search, TableProperties } from "lucide-react";
import { useMemo, useState } from "react";

type NoticeRow = {
  "D-Day": string;
  "공고번호": string;
  "공고명": string;
  "구분": string;
  "기관명": string;
  "지역": string;
  "예산": number | "";
  "마감일": string;
  "업종제한": string;
  "원문링크": string;
};

type NormalizedNotice = {
  dDay: string;
  noticeId: string;
  title: string;
  noticeType: "construction" | "goods" | "service" | "unknown";
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

const columns: (keyof NoticeRow)[] = [
  "D-Day",
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

export function App() {
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [notices, setNotices] = useState<NormalizedNotice[]>([]);
  const [from, setFrom] = useState("2026-05-01");
  const [to, setTo] = useState("2026-05-31");
  const [keyword, setKeyword] = useState("자동제어");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");

  const summary = useMemo(() => {
    const urgent = rows.filter((row) => row["D-Day"] === "D-Day" || row["D-Day"] === "D-1").length;
    const needsCheck = rows.filter((row) => row["D-Day"] === "확인필요").length;
    return { total: rows.length, urgent, needsCheck };
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
      applyPayload(
        await fetchJson<NoticePayload>("/api/collect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ from, to, keyword, apiKey })
        })
      );
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
          <span>임박</span>
          <strong>{summary.urgent}</strong>
        </div>
        <div>
          <span>확인필요</span>
          <strong>{summary.needsCheck}</strong>
        </div>
      </section>

      <section className="table-wrap" aria-label="공고 목록">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="empty" colSpan={columns.length}>
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
