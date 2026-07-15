import { describe, expect, it } from "vitest";
import { parseAttrDisplay } from "./AttrValue.js";

describe("parseAttrDisplay", () => {
  it("renders masked attributes as ?", () => {
    expect(parseAttrDisplay(undefined)).toEqual({ text: "?", masked: true, ranged: false });
  });

  it("renders exact values without ranged flag", () => {
    expect(parseAttrDisplay({ min: 14, max: 14 })).toEqual({
      text: "14",
      masked: false,
      ranged: false,
    });
  });

  it("renders ranged values as a min–max span", () => {
    expect(parseAttrDisplay({ min: 11, max: 14 })).toEqual({
      text: "11–14",
      masked: false,
      ranged: true,
    });
  });
});

describe("AttrValueCell classes", () => {
  it("maps masked and ranged flags to CSS classes", () => {
    const masked = parseAttrDisplay(undefined);
    expect(["aval", "num", masked.masked ? "masked" : "", masked.ranged ? "ranged" : ""].filter(Boolean).join(" ")).toBe(
      "aval num masked",
    );

    const ranged = parseAttrDisplay({ min: 10, max: 13 });
    expect(["aval", "num", ranged.masked ? "masked" : "", ranged.ranged ? "ranged" : ""].filter(Boolean).join(" ")).toBe(
      "aval num ranged",
    );
  });
});
