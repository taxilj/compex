import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";
import { PRIVATE_PATHS, PUBLIC_PATHS, SITE_URL } from "@/lib/site";

const APP_DIR = __dirname;
const pageFile = (route: string) =>
  path.join(APP_DIR, "(public)", route === "/" ? "" : route, "page.tsx");

describe("robots.txt", () => {
  const output = robots();
  const rule = Array.isArray(output.rules) ? output.rules[0] : output.rules;

  it("allows the site, blocks account, admin and utility routes, and points at the sitemap", () => {
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(PRIVATE_PATHS);
    for (const route of ["/admin", "/portal", "/login", "/register", "/verify-email", "/setup-account", "/tools/search-multiple"]) {
      expect(rule.disallow).toContain(route);
    }
    expect(output.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe("sitemap.xml", () => {
  const entries = sitemap();

  it("lists absolute, unique URLs for the public pages only", () => {
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => url.startsWith(SITE_URL))).toBe(true);
    expect(urls).toContain(SITE_URL);
    expect(urls).toContain(`${SITE_URL}/products`);
    for (const url of urls) {
      expect(PRIVATE_PATHS.some((prefix) => url.replace(SITE_URL, "").startsWith(prefix))).toBe(false);
    }
  });

  it("never lists a route that does not exist", () => {
    for (const route of PUBLIC_PATHS) expect(existsSync(pageFile(route)), route).toBe(true);
  });

  it("does not invent last-modified dates", () => {
    expect(entries.every((entry) => entry.lastModified === undefined)).toBe(true);
  });
});

describe("noindex routes", () => {
  const read = (relative: string) => readFileSync(path.join(APP_DIR, relative), "utf8");

  it.each([
    ["(auth)/login/layout.tsx"],
    ["(auth)/register/page.tsx"],
    ["(public)/verify-email/page.tsx"],
    ["(public)/setup-account/page.tsx"],
    ["(public)/tools/search-multiple/layout.tsx"],
    ["not-found.tsx"],
  ])("%s is noindex", (file) => {
    expect(read(file)).toMatch(/noindex:\s*true/);
  });
});
