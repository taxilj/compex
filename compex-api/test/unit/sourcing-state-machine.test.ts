import { describe, expect, it } from "vitest";
import { allowedNextSourcingStatuses } from "../../src/modules/rfqs/sourcing-state-machine.js";

describe("sourcing state machine", () => {
  it("initializes legacy RFQs deliberately and rejects skipped states", () => {
    expect(allowedNextSourcingStatuses(null)).toEqual(["NEW"]);
    expect(allowedNextSourcingStatuses("NEW")).toEqual(["REVIEWING"]);
    expect(allowedNextSourcingStatuses("QUOTE_SENT")).toEqual(["ACCEPTED", "REJECTED"]);
    expect(allowedNextSourcingStatuses("REJECTED")).toEqual([]);
    expect(allowedNextSourcingStatuses("ORDER_PROCUREMENT")).toEqual([]);
  });
});
