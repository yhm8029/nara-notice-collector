import { CheckSquare, Download, ExternalLink, Eye, FileSpreadsheet, Loader2, Search, TableProperties } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildStatus,
  deserializeNoticeMetadata,
  filterRowsByReviewStatus,
  filterAndSortRows,
  getExportNotices,
  getInitialReviewState,
  getReviewStatusLabel,
  parseTagInput,
  resolveSearchPreset,
  reviewStatuses,
  serializeNoticeMetadata,
  searchPresets,
  summarizeRows,
  type NormalizedNotice,
  type NoticeMetadata,
  type NoticeRow,
  type ReviewStatus,
  type ReviewStatusFilter,
  type NoticeTypeFilter,
  type SortMode,
  type WorkspaceStatus
} from "./notice-workspace.js";

const noticeMetadataStorageKey = "nara-notice-collector.noticeMetadata";

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
  "예산",
  "마감일",
  "업종제한",
  "원문링크"
];

const tableColumns = [...columns, "공고문"] as const;

const tableColumnLabels: Record<(typeof tableColumns)[number], string> = {
  "No.": "No.",
  공고번호: "공고번호",
  공고명: "공고명",
  구분: "구분",
  기관명: "기관명",
  예산: "예산",
  마감일: "마감일",
  업종제한: "업종제한",
  원문링크: "공고문 페이지",
  공고문: "공고문 보기"
};

export function App() {
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [notices, setNotices] = useState<NormalizedNotice[]>([]);
  const [from, setFrom] = useState("2026-05-01");
  const [to, setTo] = useState("2026-05-31");
  const [keyword, setKeyword] = useState("행정복지센터");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<WorkspaceStatus | undefined>();
  const [loading, setLoading] = useState("");
  const [noticeTypeFilter, setNoticeTypeFilter] = useState<NoticeTypeFilter>("all");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<ReviewStatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("noticeId");
  const [selectedNoticeIds, setSelectedNoticeIds] = useState<Set<string>>(new Set());
  const [activeNoticeId, setActiveNoticeId] = useState<string | undefined>();
  const [reviewState, setReviewState] = useState<Map<string, ReviewStatus>>(new Map());
  const [noticeMetadata, setNoticeMetadata] = useState<Map<string, NoticeMetadata>>(() =>
    deserializeNoticeMetadata(typeof window === "undefined" ? undefined : window.localStorage.getItem(noticeMetadataStorageKey))
  );

  const visibleRows = useMemo(
    () => filterRowsByReviewStatus(filterAndSortRows(rows, notices, { type: noticeTypeFilter, sort: sortMode }), reviewState, reviewStatusFilter),
    [noticeTypeFilter, notices, reviewState, reviewStatusFilter, rows, sortMode]
  );
  const summary = useMemo(() => summarizeRows(visibleRows), [visibleRows]);
  const activeNotice = notices.find((notice) => notice.noticeId === activeNoticeId) ?? notices[0];
  const activeNoticeMetadata = activeNotice ? noticeMetadata.get(activeNotice.noticeId) ?? { memo: "", tags: [] } : { memo: "", tags: [] };
  const selectedExportCount = selectedNoticeIds.size === 0 ? notices.length : selectedNoticeIds.size;

  useEffect(() => {
    window.localStorage.setItem(noticeMetadataStorageKey, serializeNoticeMetadata(noticeMetadata));
  }, [noticeMetadata]);

  async function loadSample() {
    setLoading("sample");
    setStatus(undefined);
    try {
      const payload = await fetchJson<NoticePayload>("/api/sample-notices");
      applyPayload(payload);
      setStatus(buildStatus("sample-loaded", payload.rows.length));
    } catch (error) {
      setStatus({ kind: "error", message: toErrorMessage(error) });
    } finally {
      setLoading("");
    }
  }

  async function collectNotices() {
    setLoading("collect");
    setStatus(undefined);
    try {
      const payload = await fetchJson<NoticePayload>("/api/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to, keyword, apiKey })
      });
      applyPayload(payload);
      setStatus(payload.rows.length === 0 ? buildStatus("empty-result") : buildStatus("collect-loaded", payload.rows.length));
    } catch (error) {
      setStatus({ kind: "error", message: toErrorMessage(error) });
    } finally {
      setLoading("");
    }
  }

  async function download(format: "csv" | "xlsx") {
    if (notices.length === 0) {
      setStatus(buildStatus("export-empty"));
      return;
    }

    const exportNotices = getExportNotices(notices, selectedNoticeIds);
    setLoading(format);
    setStatus(undefined);
    try {
      const response = await fetch(`/api/export?format=${format}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notices: exportNotices })
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
      setStatus({ kind: "error", message: toErrorMessage(error) });
    } finally {
      setLoading("");
    }
  }

  async function openNoticeDocument(row: NoticeRow) {
    const notice = notices.find((notice) => notice.noticeId === row["공고번호"]);
    const documentUrl = notice?.documentUrl;
    if (!documentUrl) {
      setStatus(buildStatus("missing-document"));
      return;
    }

    setStatus(undefined);
    try {
      const payload = await fetchJson<ViewerUrlPayload>(
        `/api/viewer-url?url=${encodeURIComponent(documentUrl)}&title=${encodeURIComponent(row["공고명"])}`
      );
      window.open(payload.viewerUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setStatus({ kind: "error", message: toErrorMessage(error) });
    }
  }

  function applyPayload(payload: NoticePayload) {
    setRows(payload.rows);
    setNotices(payload.notices);
    setSelectedNoticeIds(new Set());
    setActiveNoticeId(payload.notices[0]?.noticeId);
    setReviewState(getInitialReviewState(payload.rows));
  }

  function applyPreset(id: Parameters<typeof resolveSearchPreset>[0]) {
    const preset = resolveSearchPreset(id);
    setFrom(preset.from);
    setTo(preset.to);
    setKeyword(preset.keyword);
  }

  function toggleNoticeSelection(noticeId: string) {
    setSelectedNoticeIds((current) => {
      const next = new Set(current);
      if (next.has(noticeId)) {
        next.delete(noticeId);
      } else {
        next.add(noticeId);
      }
      return next;
    });
  }

  function updateReviewStatus(noticeId: string, status: ReviewStatus) {
    setReviewState((current) => {
      const next = new Map(current);
      next.set(noticeId, status);
      return next;
    });
  }

  function updateNoticeMemo(noticeId: string, memo: string) {
    setNoticeMetadata((current) => {
      const next = new Map(current);
      const previous = next.get(noticeId) ?? { memo: "", tags: [] };
      next.set(noticeId, { ...previous, memo });
      return next;
    });
  }

  function updateNoticeTags(noticeId: string, tagInput: string) {
    setNoticeMetadata((current) => {
      const next = new Map(current);
      const previous = next.get(noticeId) ?? { memo: "", tags: [] };
      next.set(noticeId, { ...previous, tags: parseTagInput(tagInput) });
      return next;
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>나라장터 공고 컬렉터</h1>
          <p>나라장터 공고 검토 테이블</p>
        </div>
        <div className="topbar-actions">
          <button className="primary" type="button" onClick={loadSample} disabled={loading !== ""}>
            {loading === "sample" ? <Loader2 className="spin" size={18} /> : <TableProperties size={18} />}
            샘플 데이터
          </button>
          <button type="button" onClick={() => download("csv")} disabled={loading !== "" || notices.length === 0}>
            <Download size={18} />
            CSV 내보내기
          </button>
          <button type="button" onClick={() => download("xlsx")} disabled={loading !== "" || notices.length === 0}>
            <FileSpreadsheet size={18} />
            Excel 내보내기
          </button>
        </div>
      </header>

      <section className="presets" aria-label="검색 조건 프리셋">
        {searchPresets.map((preset) => (
          <button key={preset.id} type="button" onClick={() => applyPreset(preset.id)} disabled={loading !== ""}>
            {preset.label}
          </button>
        ))}
      </section>

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

      <section className="workspace-tools" aria-label="공고 목록 도구">
        <label>
          유형
          <select value={noticeTypeFilter} onChange={(event) => setNoticeTypeFilter(event.target.value as NoticeTypeFilter)}>
            <option value="all">전체 유형</option>
            <option value="construction">공사</option>
            <option value="goods">물품</option>
            <option value="service">용역</option>
            <option value="domestic">내자</option>
          </select>
        </label>
        <label>
          검토 상태
          <select value={reviewStatusFilter} onChange={(event) => setReviewStatusFilter(event.target.value as ReviewStatusFilter)}>
            <option value="all">전체 상태</option>
            {reviewStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          정렬
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="noticeId">공고번호순</option>
            <option value="deadlineAsc">마감일 빠른순</option>
            <option value="budgetDesc">예산 높은순</option>
          </select>
        </label>
        <div className="selection-status">
          <CheckSquare size={17} />
          선택 {selectedNoticeIds.size}건 / 내보내기 {selectedExportCount}건
        </div>
      </section>

      {status ? <div className={`status ${status.kind}`}>{status.message}</div> : null}

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

      <section className="workspace-grid">
        <div className="table-wrap" aria-label="공고 목록">
          <table>
            <thead>
              <tr>
                <th>선택</th>
                <th>검토 상태</th>
                {columns.map((column) => (
                  <th key={column}>{tableColumnLabels[column]}</th>
                ))}
                <th>상세</th>
                <th>{tableColumnLabels["공고문"]}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={columns.length + 4}>
                    표시할 공고가 없습니다.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const notice = notices.find((notice) => notice.noticeId === row["공고번호"]);
                  return (
                    <tr key={row["공고번호"]} className={activeNoticeId === row["공고번호"] ? "active-row" : undefined}>
                      <td>
                        <input
                          aria-label={`${row["공고명"]} 선택`}
                          checked={selectedNoticeIds.has(row["공고번호"])}
                          onChange={() => toggleNoticeSelection(row["공고번호"])}
                          type="checkbox"
                        />
                      </td>
                      <td>
                        <select
                          aria-label={`${row["공고명"]} 검토 상태`}
                          value={reviewState.get(row["공고번호"]) ?? "unreviewed"}
                          onChange={(event) => updateReviewStatus(row["공고번호"], event.target.value as ReviewStatus)}
                        >
                          {reviewStatuses.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      {columns.map((column) => (
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
                        <button className="compact" type="button" onClick={() => setActiveNoticeId(row["공고번호"])}>
                          <Eye size={16} />
                          상세
                        </button>
                      </td>
                      <td>
                        <button
                          className="compact"
                          type="button"
                          onClick={() => void openNoticeDocument(row)}
                          disabled={!notice?.documentUrl}
                          title="나라장터 첨부파일을 Synap 공고문 뷰어로 엽니다."
                        >
                          <ExternalLink size={16} />
                          공고문 보기
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <aside className="detail-panel" aria-label="공고 상세">
          <h2>상세</h2>
          {activeNotice ? (
            <>
              <strong>{activeNotice.title}</strong>
              <dl>
                <div>
                  <dt>검토 상태</dt>
                  <dd>{getReviewStatusLabel(reviewState.get(activeNotice.noticeId) ?? "unreviewed")}</dd>
                </div>
                <div>
                  <dt>공고번호</dt>
                  <dd>{activeNotice.noticeId}</dd>
                </div>
                <div>
                  <dt>기관명</dt>
                  <dd>{activeNotice.agency}</dd>
                </div>
                <div>
                  <dt>마감일</dt>
                  <dd>{activeNotice.deadline ?? "-"}</dd>
                </div>
                <div>
                  <dt>예산</dt>
                  <dd>{activeNotice.budget ? activeNotice.budget.toLocaleString("ko-KR") : "-"}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p>공고를 선택하면 상세 정보가 표시됩니다.</p>
          )}
          <div className="review-fields">
            <label>
              검토 메모
              <textarea
                value={activeNoticeMetadata.memo}
                onChange={(event) => activeNotice && updateNoticeMemo(activeNotice.noticeId, event.target.value)}
                disabled={!activeNotice}
                rows={4}
              />
            </label>
            <label>
              태그
              <input
                value={activeNoticeMetadata.tags.join(", ")}
                onChange={(event) => activeNotice && updateNoticeTags(activeNotice.noticeId, event.target.value)}
                disabled={!activeNotice}
                placeholder="시설, 긴급"
              />
            </label>
            <div className="tag-list">
              {activeNoticeMetadata.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        </aside>
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
