import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guard: a raw error object or message must never reach a log call. Raw errors carry
// customer content (Prisma echoes query values), SMTP replies, supplier response text,
// Redis usage details and file paths. Use safeErr/describeError/describeRedisError/
// describeEmailError/emailFailureReason instead (see src/lib/safe-log.ts).

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

const LOG_CALL = /(console\.(error|warn|log|info)|\.log\.(error|warn|info)|logger\.(error|warn))\(/;
const NAME = String.raw`(err|error|e|cause|\w*Err|\w*Error)`;
const RAW_ARG = [
  new RegExp(String.raw`,\s*${NAME}\s*,?\s*\)`), // console.error("x", err) / multi-line trailing err
  new RegExp(String.raw`\(\s*${NAME}\s*[,)]`), // app.log.error(err)
  /\{\s*err(or)?\s*[,:}]/, // { err } / { err: e }
  /\b(err|error|e|cause|\w*Err|\w*Error)\.(message|stack|response)\b/, // err.message / e.stack
  new RegExp(String.raw`\$\{\s*` + NAME + String.raw`\s*\}`), // `${err}`
];

// A log call can span several lines, so each call is read until the line that closes it.
export function logCalls(text: string): Array<{ line: number; call: string }> {
  const lines = text.split(/\r?\n/);
  const calls: Array<{ line: number; call: string }> = [];
  lines.forEach((line, index) => {
    if (!LOG_CALL.test(line) || line.trim().startsWith("//")) return;
    let call = line.trim();
    for (let next = index + 1; next < Math.min(lines.length, index + 8) && !/\)\s*;?\s*$/.test(call); next += 1) {
      call += " " + lines[next].trim();
    }
    calls.push({ line: index + 1, call });
  });
  return calls;
}

describe("no raw error logging in src", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(join(__dirname, "../../src"))) {
    for (const { line, call } of logCalls(readFileSync(file, "utf8"))) {
      if (/describe(Redis|Email)?Error|safeErr|emailFailureReason/.test(call)) continue;
      if (RAW_ARG.some((pattern) => pattern.test(call))) offenders.push(`${file.split("src")[1]}:${line}: ${call.slice(0, 120)}`);
    }
  }

  it("passes errors through the safe helpers only", () => {
    expect(offenders).toEqual([]);
  });

  it("the guard itself recognises raw logging, so a green run means something", () => {
    const samples = [
      'console.error("failed", err);',
      "app.log.error(error);",
      "console.warn(`x ${err}`);",
      'console.error(\n  "failed",\n  cause,\n);',
      "console.error(e.message);",
      'req.log.error({ err }, "x");',
    ];
    for (const sample of samples) {
      const hits = logCalls(sample).filter(({ call }) => RAW_ARG.some((pattern) => pattern.test(call)));
      expect(hits, sample).toHaveLength(1);
    }
  });
});
