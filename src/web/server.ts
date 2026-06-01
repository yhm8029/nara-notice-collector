import express, { type Express } from "express";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { exportNoticesToCsv } from "../export/csv-exporter.js";
import { exportNoticesToExcelBuffer } from "../export/excel-exporter.js";
import { NaraApiClient } from "../nara/client.js";
import type { NormalizedNotice } from "../nara/types.js";
import { loadSampleRawNotices } from "../nara/sample-client.js";
import { normalizeNotices } from "../normalize/notice-normalizer.js";
import { buildNoticeExportRows } from "../export/csv-exporter.js";

export type CreateWebAppOptions = {
  enableVite?: boolean;
  env?: Record<string, string | undefined>;
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
        error: "NARA_API_KEY is required for collect mode. Enter an API key or set NARA_API_KEY locally."
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

async function createViteMiddleware(): Promise<ViteDevServer> {
  return createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
  });
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  await startWebServer();
}
