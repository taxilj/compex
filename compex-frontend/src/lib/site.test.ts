import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pageMetadata, SITE_NAME } from "./site";

describe("pageMetadata", () => {
  it("suffixes the site name, sets a relative canonical and share cards", () => {
    const meta = pageMetadata({ title: "Contact", description: "Reach us.", path: "/contact" });
    expect(meta.title).toBe(`Contact | ${SITE_NAME}`);
    expect(meta.alternates?.canonical).toBe("/contact");
    expect(meta.openGraph?.url).toBe("/contact");
    expect(meta.twitter).toMatchObject({ card: "summary", title: `Contact | ${SITE_NAME}` });
  });

  it("does not double the site name and only noindexes when asked", () => {
    expect(pageMetadata({ title: `Home | ${SITE_NAME}`, description: "d", path: "/" }).title).toBe(`Home | ${SITE_NAME}`);
    expect(pageMetadata({ title: "x", description: "d", path: "/" }).robots).toBeUndefined();
    expect(pageMetadata({ title: "x", description: "d", path: "/", noindex: true }).robots).toEqual({ index: false, follow: false });
  });
});

// Every public/auth route must resolve to its own metadata, either in the page or in a layout
// inside the route group, so no route falls back to the generic site title.
const APP_DIR = path.resolve(__dirname, "../app");
const ROUTE_ROOTS = ["(public)", "(auth)"];
const HAS_METADATA = /export\s+(const\s+metadata|async\s+function\s+generateMetadata|function\s+generateMetadata)/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function declaresMetadata(file: string): boolean {
  try {
    return HAS_METADATA.test(readFileSync(file, "utf8"));
  } catch {
    return false;
  }
}

function coveringFiles(page: string): string[] {
  const files = [page];
  for (let dir = path.dirname(page); !ROUTE_ROOTS.includes(path.basename(dir)); dir = path.dirname(dir)) {
    files.push(path.join(dir, "layout.tsx"));
  }
  return files;
}

describe("route metadata coverage", () => {
  const pages = ROUTE_ROOTS.flatMap((root) => walk(path.join(APP_DIR, root))).filter((f) => path.basename(f) === "page.tsx");

  it("finds the public routes", () => {
    expect(pages.length).toBeGreaterThan(15);
  });

  it.each(pages.map((p) => [path.relative(APP_DIR, p), p]))("%s has its own metadata", (_label, page) => {
    expect(coveringFiles(page).some(declaresMetadata)).toBe(true);
  });
});
