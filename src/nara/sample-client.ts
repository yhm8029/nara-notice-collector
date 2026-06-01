import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawNaraNotice } from "./types.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const defaultSamplePath = resolve(currentDir, "../../examples/sample-notices.json");

export async function loadSampleRawNotices(filePath = defaultSamplePath): Promise<RawNaraNotice[]> {
  const content = await readFile(filePath, "utf8");
  const parsed = JSON.parse(content) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Sample notices must be a JSON array.");
  }

  return parsed as RawNaraNotice[];
}
