import { describe, expect, it } from "vitest";
import { createPayload, updatePayload } from "./form-payload";

describe("createPayload", () => {
  it("omits blank, null and undefined fields but keeps real values including 0 and false", () => {
    expect(createPayload({ name: "Acme", website: "", notes: "  ", country: undefined, mov: null, spq: 0, active: false }))
      .toEqual({ name: "Acme", spq: 0, active: false });
  });
});

describe("updatePayload", () => {
  const original = { name: "Acme", website: "https://a.test", country: "INDIA", mov: 500, notes: "" };

  it("sends nothing when nothing changed (so a retired Settings value that is not touched is never resubmitted)", () => {
    expect(updatePayload({ ...original }, original)).toEqual({});
  });

  it("sends only changed fields", () => {
    expect(updatePayload({ ...original, name: "Acme Ltd" }, original)).toEqual({ name: "Acme Ltd" });
  });

  it("sends an explicit null when a value is erased, so it can actually be cleared", () => {
    expect(updatePayload({ ...original, website: "", country: "  ", mov: null as unknown as number }, original)).toEqual({ website: null, country: null, mov: null });
  });

  it("does not report a blank that was already blank as a change", () => {
    expect(updatePayload({ ...original, notes: "" }, { ...original, notes: null as unknown as string })).toEqual({});
  });

  it("sends a newly filled field that was previously empty", () => {
    expect(updatePayload({ ...original, notes: "hello" }, original)).toEqual({ notes: "hello" });
  });
});
