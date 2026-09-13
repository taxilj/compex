import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { industries } from "./industries-data";

const PUBLIC_DIR = join(__dirname, "../../../../public");

describe("industries-data", () => {
  it("renders exactly the 9 existing COMPEX industries", () => {
    expect(industries).toHaveLength(9);
    expect(industries.map((i) => i.name)).toEqual([
      "Automotive Electronics",
      "Industrial Automation",
      "Power & Energy",
      "Defense & Aerospace",
      "Medical Devices",
      "Consumer Electronics",
      "Telecom & Networking",
      "Railway & Infrastructure",
      "IoT & Embedded Systems",
    ]);
  });

  it("gives every industry a non-empty image path", () => {
    for (const industry of industries) {
      expect(industry.image.trim().length).toBeGreaterThan(0);
    }
  });

  it("never maps two industries to the same image", () => {
    const paths = industries.map((i) => i.image);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("gives every industry meaningful, industry-specific alt text (not a generic template)", () => {
    for (const industry of industries) {
      expect(industry.imageAlt.trim().length).toBeGreaterThan(15);
      // Reject the old generic pattern this feature replaces.
      expect(industry.imageAlt).not.toBe(`${industry.name} electronic components`);
    }
    const altTexts = industries.map((i) => i.imageAlt);
    expect(new Set(altTexts).size).toBe(altTexts.length);
  });

  it("resolves every declared image to a real, existing file (no missing-asset ship)", () => {
    for (const industry of industries) {
      const diskPath = join(PUBLIC_DIR, industry.image);
      expect(existsSync(diskPath), `${industry.image} (for ${industry.name}) does not exist on disk`).toBe(true);
    }
  });

  it("keeps each industry's slug unique and paired with its own dedicated image, not borrowed from a sibling", () => {
    const slugs = industries.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const industry of industries) {
      expect(industry.image).toContain(industry.slug);
      const others = industries.filter((i) => i.slug !== industry.slug);
      for (const other of others) {
        expect(other.image).not.toBe(industry.image);
      }
    }
  });
});
