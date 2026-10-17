import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMetadata } from "./layout";
import { SITE_NAME } from "@/lib/site";

const meta = (mpn: string) => generateMetadata({ params: Promise.resolve({ mpn }) });

afterEach(() => vi.restoreAllMocks());

// The title, description, canonical and share card are built from the URL's MPN alone. That keeps the
// first server-rendered response specific to the part and means a slow or unavailable catalogue API
// can neither delay nor break the page head.
describe("product detail metadata", () => {
  it("builds a part-specific title, description, canonical and Open Graph card", async () => {
    const result = await meta("STM32F103C8T6");
    expect(result.title).toBe(`STM32F103C8T6 — Electronic Component | ${SITE_NAME}`);
    expect(result.description).toContain("STM32F103C8T6");
    expect(result.alternates?.canonical).toBe("/products/STM32F103C8T6");
    expect(result.openGraph).toMatchObject({ title: result.title, url: "/products/STM32F103C8T6", siteName: SITE_NAME, type: "website" });
    expect(result.twitter).toMatchObject({ title: result.title });
    expect(result.robots).toBeUndefined();
  });

  it("never falls back to the generic site title", async () => {
    const result = await meta("LM358DR");
    expect(String(result.title)).not.toBe(SITE_NAME);
    expect(String(result.title)).toContain("LM358DR");
  });

  it("decodes the MPN for display and re-encodes it in the canonical path", async () => {
    const result = await meta("ABC%2F123%20X");
    expect(String(result.title)).toContain("ABC/123 X");
    expect(result.alternates?.canonical).toBe("/products/ABC%2F123%20X");
  });

  it("survives a malformed escape sequence instead of throwing", async () => {
    const result = await meta("%E0%A4%A");
    expect(String(result.title)).toContain("%E0%A4%A");
  });

  it("makes no API request, so a slow or failing API cannot affect it", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("API unavailable"));
    await meta("STM32F103C8T6");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
