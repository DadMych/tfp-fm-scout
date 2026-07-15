import { describe, expect, it } from "vitest";
import { parseCompareRefs, serializeCompareRefs } from "./compare-url";

describe("compare URL", () => {
  it("round-trips up to four player refs", () => {
    const refs = [
      { kind: "shortlist" as const, id: "p1" },
      { kind: "squad" as const, id: "p2" },
      { kind: "shortlist" as const, id: "p3" },
    ];
    const href = serializeCompareRefs(refs);
    expect(href).toBe("/compare?a=shortlist%3Ap1&b=squad%3Ap2&c=shortlist%3Ap3");
    expect(parseCompareRefs(new URLSearchParams(href.split("?")[1]))).toEqual(refs);
  });

  it("ignores malformed refs", () => {
    expect(parseCompareRefs(new URLSearchParams({ a: "nocolon", b: "bad:ok" }))).toEqual([]);
  });
});
