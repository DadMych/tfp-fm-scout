import { describe, expect, it } from "vitest";
import { parseAnchorRef, similarHref, upgradesHref } from "./scout-anchor-url";

describe("scout anchor URL", () => {
  it("parses anchor ref from query", () => {
    expect(parseAnchorRef(new URLSearchParams("anchor=shortlist%3Ap1"))).toEqual({
      kind: "shortlist",
      id: "p1",
    });
    expect(parseAnchorRef(new URLSearchParams())).toBeNull();
  });

  it("builds similar and upgrades hrefs", () => {
    expect(similarHref("squad", "x1")).toBe("/similar?anchor=squad%3Ax1");
    expect(upgradesHref("squad", "x1")).toBe("/upgrades?anchor=squad%3Ax1");
  });
});
