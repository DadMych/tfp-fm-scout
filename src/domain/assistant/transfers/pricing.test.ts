import { describe, expect, it } from "vitest";
import { saleProceeds, computePriceBand } from "./pricing.js";
import { T } from "../thresholds.js";

describe("saleProceeds (doc 19 §4)", () => {
  it("applies the −10% haircut to list value", () => {
    expect(saleProceeds(10_000_000)).toBe(Math.round(10_000_000 * T.SALE_HAIRCUT));
  });

  it("bakes the haircut into price-band ask", () => {
    const band = computePriceBand(50_000_000, 25, false);
    expect(band?.ask).toBeLessThan(50_000_000);
    expect(band!.ask).toBe(saleProceeds(50_000_000));
  });
});
