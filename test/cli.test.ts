import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";

describe("CLI", () => {
  it("writes sample notices to CSV", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nara-cli-"));
    const output = join(dir, "sample-notices.csv");

    try {
      const exitCode = await runCli(["sample", "--format", "csv", "--output", output]);
      const csv = await readFile(output, "utf8");

      expect(exitCode).toBe(0);
      expect(csv.split("\n")[0]).toBe("D-Day,공고번호,공고명,구분,기관명,지역,예산,마감일,업종제한,원문링크");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes sample notices to Excel", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nara-cli-"));
    const output = join(dir, "sample-notices.xlsx");

    try {
      const exitCode = await runCli(["sample", "--format", "xlsx", "--output", output]);

      expect(exitCode).toBe(0);
      await expect(access(output)).resolves.toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns a friendly collect error when the API key is missing", async () => {
    const messages: string[] = [];

    const exitCode = await runCli(
      ["collect", "--from", "2026-05-01", "--to", "2026-05-31", "--keyword", "자동제어", "--output", "unused.xlsx"],
      {
        env: {},
        stderr: (message) => messages.push(message)
      }
    );

    expect(exitCode).toBe(1);
    expect(messages.join("\n")).toContain("NARA_API_KEY");
  });
});
