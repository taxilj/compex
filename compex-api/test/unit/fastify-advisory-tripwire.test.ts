import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// `npm audit --omit=dev` reports Fastify 4 / find-my-way advisories whose fixes need Fastify 5
// (a major upgrade, tracked as a separate change). None is exploitable today because each
// requires a feature this API does not use. This test fails the moment one is introduced, so
// the upgrade has to happen first instead of silently becoming a live vulnerability:
//   GHSA-p68q-wchp-6fh7  auth bypass via encapsulated not-found handlers  -> setNotFoundHandler
//   GHSA-jx2c-rxcm-jvmq, GHSA-w2qp-rph6-63g4, GHSA-hwr6-493r-vm6h, GHSA-9q9j-q6p8-xq58,
//   GHSA-667r-xxjv-c9mm  schema/validation bypasses                         -> route `schema:` / $async / custom compilers
//   GHSA-444r-cwp2-x5xf  request.protocol/host spoofing                     -> request.protocol / request.host
//   GHSA-4mh8-r7rc-xpvc, GHSA-c96f-x56v-gq3h  HTTP/2 issues                 -> http2 servers
//   GHSA-mrq3-vjjr-p77c  sendWebStream memory DoS                           -> sending web streams

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

const RISKY: Array<[string, RegExp]> = [
  ["setNotFoundHandler (GHSA-p68q-wchp-6fh7)", /setNotFoundHandler/],
  ["route-level JSON schema (validation-bypass advisories)", /^\s*schema\s*:\s*\{/m],
  ["$async / custom validator compiler (GHSA-667r-xxjv-c9mm)", /\$async|setValidatorCompiler|validatorCompiler/],
  ["request.protocol / request.host (GHSA-444r-cwp2-x5xf)", /\b(req|request)\.(protocol|host)\b/],
  ["HTTP/2 server (GHSA-4mh8-r7rc-xpvc, GHSA-c96f-x56v-gq3h)", /http2\s*:\s*true|from\s+["']node:http2["']/],
  ["web stream replies (GHSA-mrq3-vjjr-p77c)", /new ReadableStream|Readable\.toWeb/],
];

describe("Fastify 4 advisories stay non-exploitable until the Fastify 5 upgrade", () => {
  const found: string[] = [];
  for (const file of sourceFiles(join(__dirname, "../../src"))) {
    const text = readFileSync(file, "utf8");
    for (const [label, pattern] of RISKY) if (pattern.test(text)) found.push(`${label} in ${file.split("src")[1]}`);
  }

  it("uses none of the affected Fastify features", () => {
    expect(found).toEqual([]);
  });
});
