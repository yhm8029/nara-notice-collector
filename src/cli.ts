#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { exportNoticesToCsv } from "./export/csv-exporter.js";
import { exportNoticesToExcel } from "./export/excel-exporter.js";
import { createNaraClientFromEnv } from "./nara/client.js";
import { loadSampleRawNotices } from "./nara/sample-client.js";
import { normalizeNotices } from "./normalize/notice-normalizer.js";

type CliFormat = "csv" | "xlsx";

type CliIo = {
  env?: Record<string, string | undefined>;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

type ParsedArgs = {
  command?: string;
  options: Record<string, string | boolean>;
};

export async function runCli(argv: string[], io: CliIo = {}): Promise<number> {
  const parsed = parseArgs(argv);
  const stderr = io.stderr ?? ((message: string) => console.error(message));
  const stdout = io.stdout ?? ((message: string) => console.log(message));

  try {
    if (parsed.command === "sample") {
      await runSampleCommand(parsed.options);
      stdout(`Wrote sample notices to ${parsed.options.output}`);
      return 0;
    }

    if (parsed.command === "collect") {
      await runCollectCommand(parsed.options, io.env ?? process.env);
      return 0;
    }

    stderr(helpText());
    return 1;
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function runSampleCommand(options: Record<string, string | boolean>): Promise<void> {
  const output = getRequiredStringOption(options, "output");
  const format = resolveFormat(options.format, output);

  await ensureOutputDirectory(output);

  const rawNotices = await loadSampleRawNotices();
  const notices = normalizeNotices(rawNotices);

  if (format === "csv") {
    await writeFile(output, exportNoticesToCsv(notices), "utf8");
    return;
  }

  await exportNoticesToExcel(notices, output);
}

async function runCollectCommand(
  options: Record<string, string | boolean>,
  env: Record<string, string | undefined>
): Promise<void> {
  const output = getRequiredStringOption(options, "output");
  const format = resolveFormat(options.format, output);
  getRequiredStringOption(options, "from");
  getRequiredStringOption(options, "to");
  const keyword = typeof options.keyword === "string" ? options.keyword : undefined;

  if (!env.NARA_API_KEY) {
    throw new Error(
      "NARA_API_KEY is required for collect mode. Set NARA_API_KEY or run the sample command without an API key."
    );
  }

  const client = createNaraClientFromEnv(env);
  const rawNotices = await client.searchNotices({
    from: String(options.from),
    to: String(options.to),
    keyword
  });
  const notices = normalizeNotices(rawNotices);
  await ensureOutputDirectory(output);

  if (format === "csv") {
    await writeFile(output, exportNoticesToCsv(notices), "utf8");
    return;
  }

  await exportNoticesToExcel(notices, output);
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }

  return { command, options };
}

function resolveFormat(value: string | boolean | undefined, outputPath: string): CliFormat {
  if (value === "csv" || value === "xlsx") {
    return value;
  }
  if (value !== undefined) {
    throw new Error("--format must be csv or xlsx.");
  }

  const extension = extname(outputPath).toLowerCase();
  if (extension === ".csv") {
    return "csv";
  }
  return "xlsx";
}

function getRequiredStringOption(options: Record<string, string | boolean>, key: string): string {
  const value = options[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`--${key} is required.`);
  }
  return value;
}

async function ensureOutputDirectory(outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
}

function helpText(): string {
  return [
    "Usage:",
    "  nara-notice-collector sample --format csv|xlsx --output ./output/sample-notices.xlsx",
    "  nara-notice-collector collect --from YYYY-MM-DD --to YYYY-MM-DD --keyword 행정복지센터 --format xlsx --output ./output/notices.xlsx"
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}
