import { describe, it, expect } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { calcLandedCost } from "../../src/modules/admin/admin.landed-cost.routes.js";

describe("calcLandedCost", () => {
  it("preserves full Decimal precision when given Decimal inputs (PATCH merge path)", () => {
    // A 6-decimal-place exchange rate is exactly the kind of value that loses
    // precision if round-tripped through a JS number before recomputation —
    // the bug this fixes. Passing it as a genuine Decimal must not truncate it.
    const preciseRate = new Decimal("83.123456");
    const unitCost = new Decimal("10.5");

    const result = calcLandedCost(unitCost, {
      quantity: 3,
      exchangeRate: preciseRate,
      shipping: new Decimal(0),
      insurance: new Decimal(0),
      customsDuty: new Decimal(0),
      igst: new Decimal(0),
      handling: new Decimal(0),
      otherCosts: new Decimal(0),
      marginPercent: new Decimal(0),
    });

    // productCost = unitCost * quantity * exchangeRate, computed at full precision
    const expected = unitCost.mul(3).mul(preciseRate).toDecimalPlaces(4);
    expect(result.productCost.toString()).toBe(expected.toString());
  });

  it("gives identical results whether a value arrives as a fresh number or an existing Decimal", () => {
    const unitCost = new Decimal("4.5");
    const asNumber = calcLandedCost(unitCost, {
      quantity: 100, exchangeRate: 83.123456, shipping: 10, insurance: 5,
      customsDuty: 2, igst: 1, handling: 0, otherCosts: 0, marginPercent: 15,
    });
    const asDecimal = calcLandedCost(unitCost, {
      quantity: 100, exchangeRate: new Decimal("83.123456"), shipping: new Decimal(10), insurance: new Decimal(5),
      customsDuty: new Decimal(2), igst: new Decimal(1), handling: new Decimal(0), otherCosts: new Decimal(0), marginPercent: new Decimal(15),
    });

    expect(asDecimal.productCost.toString()).toBe(asNumber.productCost.toString());
    expect(asDecimal.landedCost.toString()).toBe(asNumber.landedCost.toString());
    expect(asDecimal.customerPrice.toString()).toBe(asNumber.customerPrice.toString());
  });
});
