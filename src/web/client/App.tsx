import {
  Building2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Search,
  TableProperties
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type NoticeRow = {
  "No.": number;
  "공고번호": string;
  "공고명": string;
  "구분": string;
  "기관명": string;
  "예산": string;
  "마감일": string;
  "업종제한": string;
  "낙찰자": string;
  "낙찰자 연락처": string;
  "원문링크": string;
};

type ProcurementCorpRow = {
  "No.": number;
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
  documentUrl?: string;
  winner?: {
    companyName?: string;
    businessNumber?: string;
    phoneNumber?: string;
  };
  raw?: Record<string, unknown>;
};

type NoticePayload = {
  rows: NoticeRow[];
  notices: NormalizedNotice[];
};

type ProcurementCorpPayload = {
  rows: ProcurementCorpRow[];
};

type ProcurementCorpPagePayload = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  rows: ProcurementCorpRow[];
};

type ProcurementCorpCollectionStatus = {
  error?: string;
  failedRanges: ProcurementCorpFailedRange[];
  finishedAt?: string;
  running: boolean;
  savedCount: number;
  startedAt?: string;
  stopRequested: boolean;
};

type ProcurementCorpFailedRange = {
  from: string;
  to: string;
  error: string;
};

type ViewerUrlPayload = {
  mode: "synap" | "source";
  viewerUrl: string;
  message?: string;
};

type ActiveView = "notices" | "corps";

const noticeColumns: (keyof NoticeRow)[] = [
  "No.",
  "공고번호",
  "공고명",
  "구분",
  "기관명",
  "예산",
  "마감일",
  "업종제한",
  "낙찰자",
  "낙찰자 연락처",
  "원문링크"
];

const noticeTableColumns = [...noticeColumns, "공고문"] as const;

const corpColumns: (keyof ProcurementCorpRow)[] = [
  "No.",
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
];

export function App() {
  const [activeView, setActiveView] = useState<ActiveView>("notices");
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [notices, setNotices] = useState<NormalizedNotice[]>([]);
  const [from, setFrom] = useState("2026-05-01");
  const [to, setTo] = useState("2026-05-31");
  const [keyword, setKeyword] = useState("행정복지센터");
  const [apiKey, setApiKey] = useState("");
  const [corpRows, setCorpRows] = useState<ProcurementCorpRow[]>([]);
  const [corpPage, setCorpPage] = useState(1);
  const [corpTotalCount, setCorpTotalCount] = useState(0);
  const [corpTotalPages, setCorpTotalPages] = useState(1);
  const [corpStatus, setCorpStatus] = useState<ProcurementCorpCollectionStatus>({
    failedRanges: [],
    running: false,
    savedCount: 0,
    stopRequested: false
  });
  const [corpApiKey, setCorpApiKey] = useState("");
  const [corpInqryDiv, setCorpInqryDiv] = useState("2");
  const [corpWorkerCount, setCorpWorkerCount] = useState(2);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");

  useEffect(() => {
    if (activeView !== "corps") {
      return;
    }

    void refreshProcurementCorpStatus();
    void loadProcurementCorpPage(corpPage);

    if (!corpStatus.running) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshProcurementCorpStatus();
      void loadProcurementCorpPage(corpPage);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [activeView, corpPage, corpStatus.running]);

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

  async function startProcurementCorpCollection() {
    await startProcurementCorpCollectionWithRanges();
  }

  async function retryFailedProcurementCorpRanges() {
    await startProcurementCorpCollectionWithRanges(corpStatus.failedRanges);
  }

  async function startProcurementCorpCollectionWithRanges(retryRanges?: ProcurementCorpFailedRange[]) {
    setLoading("corp-collect");
    setError("");
    try {
      const status = await fetchJson<ProcurementCorpCollectionStatus>("/api/procurement-corps/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey: corpApiKey,
          inqryDiv: corpInqryDiv,
          retryRanges,
          workerCount: corpWorkerCount
        })
      });
      setCorpStatus(status);
      setCorpPage(1);
      await loadProcurementCorpPage(1);
    } catch (error) {
      setError(toErrorMessage(error));
    } finally {
      setLoading("");
    }
  }

  async function stopProcurementCorpCollection() {
    setError("");
    try {
      setCorpStatus(
        await fetchJson<ProcurementCorpCollectionStatus>("/api/procurement-corps/stop", {
          method: "POST"
        })
      );
    } catch (error) {
      setError(toErrorMessage(error));
    }
  }

  async function refreshProcurementCorpStatus() {
    try {
      const status = await fetchJson<ProcurementCorpCollectionStatus>("/api/procurement-corps/status");
      setCorpStatus(status);
      if (status.error) {
        setError(status.error);
      }
    } catch (error) {
      setError(toErrorMessage(error));
    }
  }

  async function loadProcurementCorpPage(page: number) {
    try {
      const payload = await fetchJson<ProcurementCorpPagePayload>(`/api/procurement-corps?page=${page}&pageSize=20`);
      setCorpRows(payload.rows);
      setCorpPage(payload.page);
      setCorpTotalCount(payload.totalCount);
      setCorpTotalPages(payload.totalPages);
    } catch (error) {
      setError(toErrorMessage(error));
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

  async function downloadProcurementCorps(format: "csv" | "xlsx") {
    if (corpTotalCount === 0) {
      setError("먼저 사업자 데이터를 수집하세요.");
      return;
    }

    setLoading(`corp-${format}`);
    setError("");
    try {
      const response = await fetch(`/api/procurement-corps/export?format=${format}`);
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `procurement-corps.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setError(toErrorMessage(error));
    } finally {
      setLoading("");
    }
  }

  async function openNoticeDocument(row: NoticeRow) {
    const notice = notices.find((notice) => notice.noticeId === row["공고번호"]);
    const documentUrl = notice?.documentUrl;
    if (!documentUrl) {
      setError("공고문 첨부 링크가 없는 공고입니다.");
      return;
    }

    setError("");
    try {
      const payload = await fetchJson<ViewerUrlPayload>(
        `/api/viewer-url?url=${encodeURIComponent(documentUrl)}&title=${encodeURIComponent(row["공고명"])}`
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
      <aside className="sidebar" aria-label="메뉴">
        <div className="brand">
          <h1>나라장터 공고 컬렉터</h1>
          <p>나라장터 로컬 수집 도구</p>
        </div>
        <nav className="side-menu">
          <button
            className={activeView === "notices" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("notices")}
          >
            <TableProperties size={18} />
            나라장터 공고 검토
          </button>
          <button
            className={activeView === "corps" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("corps")}
          >
            <Building2 size={18} />
            사업자 조회
          </button>
        </nav>
      </aside>

      <section className="workspace">
        {error ? <div className="error">{error}</div> : null}
        <div hidden={activeView !== "notices"}>{renderNoticeView()}</div>
        <div hidden={activeView !== "corps"}>{renderCorpView()}</div>
      </section>
    </main>
  );

  function renderNoticeView() {
    return (
      <>
        <header className="topbar">
          <div>
            <h2>나라장터 공고 검토</h2>
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
                {noticeTableColumns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={noticeTableColumns.length}>
                    표시할 공고가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row["공고번호"]}>
                    {noticeColumns.map((column) => (
                      <td key={column} className={column === "공고명" || column === "원문링크" ? "wide" : undefined}>
                        {column === "원문링크" && row[column] ? (
                          <a href={row[column]} target="_blank" rel="noreferrer">
                            열기
                          </a>
                        ) : (
                          row[column]
                        )}
                      </td>
                    ))}
                    <td>
                      <button
                        className="compact"
                        type="button"
                        onClick={() => void openNoticeDocument(row)}
                        disabled={!notices.find((notice) => notice.noticeId === row["공고번호"])?.documentUrl}
                        title="나라장터 첨부파일을 Synap 공고문 뷰어로 엽니다."
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
      </>
    );
  }

  function renderCorpView() {
    return (
      <>
        <header className="topbar">
          <div>
            <h2>사업자 조회</h2>
            <p>월별 자동 분할로 나라장터 조달업체 기본정보를 수집합니다.</p>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={() => void downloadProcurementCorps("csv")} disabled={loading !== "" || corpTotalCount === 0}>
              <Download size={18} />
              사업자 CSV
            </button>
            <button type="button" onClick={() => void downloadProcurementCorps("xlsx")} disabled={loading !== "" || corpTotalCount === 0}>
              <FileSpreadsheet size={18} />
              사업자 Excel
            </button>
          </div>
        </header>

        <section className="controls corp-controls" aria-label="사업자 번호 수집">
          <label>
            조회 기준
            <select value={corpInqryDiv} onChange={(event) => setCorpInqryDiv(event.target.value)}>
              <option value="2">변경일 기준</option>
              <option value="1">등록일 기준</option>
            </select>
          </label>
          <label>
            워커 수
            <input
              value={corpWorkerCount}
              min={1}
              max={5}
              onChange={(event) => setCorpWorkerCount(clampWorkerCount(Number(event.target.value)))}
              type="number"
            />
          </label>
          <label className="api-key">
            API 키
            <input
              value={corpApiKey}
              onChange={(event) => setCorpApiKey(event.target.value)}
              type="password"
              autoComplete="off"
            />
          </label>
          <button
            className="primary"
            type="button"
            onClick={startProcurementCorpCollection}
            disabled={loading !== "" || corpStatus.running}
          >
            {loading === "corp-collect" ? <Loader2 className="spin" size={18} /> : <Building2 size={18} />}
            사업자 수집
          </button>
          <button type="button" onClick={stopProcurementCorpCollection} disabled={!corpStatus.running}>
            멈춤
          </button>
          <button
            type="button"
            onClick={() => void retryFailedProcurementCorpRanges()}
            disabled={loading !== "" || corpStatus.running || corpStatus.failedRanges.length === 0}
          >
            실패 월 재시도
          </button>
          <p className="control-note">월별로 쪼개고 10개월 단위 작업을 최대 5개 워커가 병렬 처리합니다. 50개마다 DB에 저장하고 화면을 갱신합니다. 429가 나면 워커 수를 낮추세요.</p>
        </section>

        <section className="summary corp-summary" aria-label="사업자 수집 요약">
          <div>
            <span>DB 저장 업체</span>
            <strong>{corpTotalCount}</strong>
          </div>
          <div>
            <span>이번 작업 저장</span>
            <strong>{corpStatus.savedCount}</strong>
          </div>
          <div>
            <span>상태</span>
            <strong>{corpStatus.running ? "수집중" : corpStatus.stopRequested ? "중지됨" : "대기"}</strong>
          </div>
          <div>
            <span>실패 월</span>
            <strong>{corpStatus.failedRanges.length}</strong>
          </div>
        </section>

        <section className="failed-ranges" aria-label="실패 월">
          <h3>실패 월</h3>
          {corpStatus.failedRanges.length === 0 ? (
            <p>기록된 실패 월이 없습니다.</p>
          ) : (
            <ul>
              {corpStatus.failedRanges.map((range) => (
                <li key={`${range.from}-${range.to}`}>
                  {range.from} ~ {range.to}: {range.error}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="table-wrap" aria-label="사업자 목록">
          <table className="corp-table">
            <thead>
              <tr>
                {corpColumns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpRows.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={corpColumns.length}>
                    표시할 사업자가 없습니다.
                  </td>
                </tr>
              ) : (
                corpRows.map((row) => (
                  <tr key={`${row["No."]}-${row["사업자등록번호"]}`}>
                    {corpColumns.map((column) => (
                      <td key={column} className={column === "주소" || column === "상세주소" ? "wide" : undefined}>
                        {column === "홈페이지주소" && row[column] ? (
                          <a href={toExternalUrl(row[column])} target="_blank" rel="noreferrer">
                            {row[column]}
                          </a>
                        ) : (
                          row[column]
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
        <div className="pagination">
          <button type="button" onClick={() => void loadProcurementCorpPage(corpPage - 1)} disabled={corpPage <= 1}>
            이전
          </button>
          <span>
            {corpPage} / {corpTotalPages}
          </span>
          <button
            type="button"
            onClick={() => void loadProcurementCorpPage(corpPage + 1)}
            disabled={corpPage >= corpTotalPages}
          >
            다음
          </button>
        </div>
      </>
    );
  }
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

function toExternalUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function clampWorkerCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 5;
  }
  return Math.min(5, Math.max(1, Math.floor(value)));
}
