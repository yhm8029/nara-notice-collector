import express, { type Express } from "express";
import { pathToFileURL } from "node:url";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { exportNoticesToCsv } from "../export/csv-exporter.js";
import { exportNoticesToExcelBuffer } from "../export/excel-exporter.js";
import { NaraApiClient } from "../nara/client.js";
import type { NormalizedNotice } from "../nara/types.js";
import { loadSampleRawNotices } from "../nara/sample-client.js";
import { normalizeNotices } from "../normalize/notice-normalizer.js";
import { buildNoticeExportRows } from "../export/csv-exporter.js";
import { buildSynapViewerUrl } from "./synap-viewer.js";
import { isG2bAttachmentDownloadUrl, resolveG2bSynapViewerUrl } from "./g2b-synap-resolver.js";

export type CreateWebAppOptions = {
  enableVite?: boolean;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
};

export async function createWebApp(options: CreateWebAppOptions = {}): Promise<Express> {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/sample-notices", async (_request, response) => {
    const notices = normalizeNotices(await loadSampleRawNotices());
    response.json(toNoticePayload(notices));
  });

  app.post("/api/collect", async (request, response) => {
    const { from, to, keyword, apiKey } = request.body as {
      from?: string;
      to?: string;
      keyword?: string;
      apiKey?: string;
    };

    if (!from || !to) {
      response.status(400).json({ error: "from and to are required." });
      return;
    }

    const resolvedApiKey = apiKey || options.env?.NARA_API_KEY || process.env.NARA_API_KEY;
    if (!resolvedApiKey) {
      response.status(400).json({
        error: "API 키를 입력하거나 로컬 환경변수 NARA_API_KEY를 설정하세요."
      });
      return;
    }

    try {
      const client = new NaraApiClient({ apiKey: resolvedApiKey });
      const notices = normalizeNotices(await client.searchNotices({ from, to, keyword }));
      response.json(toNoticePayload(notices));
    } catch (error) {
      response.status(502).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/export", async (request, response) => {
    const format = request.query.format === "xlsx" ? "xlsx" : "csv";
    const notices = readPostedNotices(request.body);

    if (format === "csv") {
      response.setHeader("content-type", "text/csv; charset=utf-8");
      response.setHeader("content-disposition", 'attachment; filename="nara-notices.csv"');
      response.send(exportNoticesToCsv(notices));
      return;
    }

    const buffer = await exportNoticesToExcelBuffer(notices);
    response.setHeader(
      "content-type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    response.setHeader("content-disposition", 'attachment; filename="nara-notices.xlsx"');
    response.send(buffer);
  });

  app.get("/api/viewer-url", async (request, response) => {
    const sourceUrl = readQueryString(request.query.url);
    const title = readQueryString(request.query.title);
    const template = options.env?.SYNAP_VIEWER_URL_TEMPLATE ?? process.env.SYNAP_VIEWER_URL_TEMPLATE;

    try {
      if (isG2bAttachmentDownloadUrl(sourceUrl)) {
        const viewerUrl = await resolveG2bSynapViewerUrl({ sourceUrl, fetchImpl: options.fetch });
        if (!viewerUrl) {
          response.status(502).json({ error: "나라장터 Synap 공고문 링크를 만들지 못했습니다." });
          return;
        }

        response.json(toLocalViewerResult(buildSynapViewerUrl({ sourceUrl: viewerUrl, title }, { template }), title));
        return;
      }

      const result = buildSynapViewerUrl({ sourceUrl, title }, { template });
      if (!isAllowedSynapViewerUrl(result.viewerUrl)) {
        response.status(502).json({ error: "Synap 공고문 보기 URL이 없어 다운로드를 차단했습니다." });
        return;
      }

      response.json(toLocalViewerResult(result, title));
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/viewer", (request, response) => {
    const viewerUrl = readQueryString(request.query.url);
    const title = readQueryString(request.query.title) || "공고문";

    try {
      const html = renderLocalViewerHtml({ viewerUrl, title });
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.send(html);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  if (options.enableVite !== false) {
    const vite = await createViteMiddleware();
    app.use(vite.middlewares);
  }

  return app;
}

export async function startWebServer(port = Number(process.env.PORT ?? 5173)): Promise<void> {
  const app = await createWebApp();
  app.listen(port, "127.0.0.1", () => {
    console.log(`nara-notice-collector web UI: http://127.0.0.1:${port}`);
  });
}

function toLocalViewerResult(result: ReturnType<typeof buildSynapViewerUrl>, title: string) {
  return {
    ...result,
    viewerUrl: buildLocalViewerUrl(result.viewerUrl, title)
  };
}

function buildLocalViewerUrl(viewerUrl: string, title: string): string {
  return `/viewer?url=${encodeURIComponent(viewerUrl)}&title=${encodeURIComponent(title)}`;
}

function renderLocalViewerHtml(input: { viewerUrl: string; title: string }): string {
  const viewerUrl = normalizeHttpUrl(input.viewerUrl);
  if (!isAllowedSynapViewerUrl(viewerUrl)) {
    throw new Error("Synap 공고문 보기 URL만 열 수 있습니다.");
  }

  const title = input.title.trim() || "공고문";
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        background: #f5f5f5;
        color: #222;
        font-family: "Malgun Gothic", Arial, sans-serif;
      }
      .viewer-shell {
        display: grid;
        grid-template-rows: 44px 1fr;
        width: 100%;
        height: 100%;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 0 14px;
        border-bottom: 1px solid #d7d7d7;
        background: #fff;
      }
      h1 {
        overflow: hidden;
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      a {
        flex: 0 0 auto;
        color: #1658a8;
        font-size: 13px;
        text-decoration: none;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: 0;
        background: #fff;
      }
    </style>
  </head>
  <body>
    <div class="viewer-shell">
      <header>
        <h1>${escapeHtml(title)}</h1>
        <a href="${escapeHtml(viewerUrl)}" target="_blank" rel="noreferrer">새 탭에서 열기</a>
      </header>
      <iframe src="${escapeHtml(viewerUrl)}" title="${escapeHtml(title)}"></iframe>
    </div>
  </body>
</html>`;
}

function isAllowedSynapViewerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.hostname.endsWith("g2b.go.kr") && url.pathname.includes("/SynapDocViewServer/viewer/doc.html")) {
      return true;
    }

    return url.hostname.toLowerCase().includes("synap");
  } catch {
    return false;
  }
}

function normalizeHttpUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("공고문 보기 URL 형식이 올바르지 않습니다.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("공고문 보기 URL은 http 또는 https 주소여야 합니다.");
  }

  return parsed.href;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toNoticePayload(notices: NormalizedNotice[]) {
  return {
    notices,
    rows: buildNoticeExportRows(notices)
  };
}

function readPostedNotices(body: unknown): NormalizedNotice[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const notices = (body as { notices?: unknown }).notices;
  return Array.isArray(notices) ? (notices as NormalizedNotice[]) : [];
}

function readQueryString(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }
  return typeof value === "string" ? value : "";
}

async function createViteMiddleware(): Promise<ViteDevServer> {
  return createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startWebServer();
}
