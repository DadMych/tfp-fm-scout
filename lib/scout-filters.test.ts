import { describe, expect, it } from "vitest";
import {
  parseScoutFilters,
  serializeAssistantScoutFilters,
  serializeScoutFilters,
  scoutHrefForStyle,
} from "./scout-filters";

describe("scout filters URL", () => {
  it("round-trips a filtered desk URL", () => {
    const initial = new URLSearchParams({
      kind: "squad",
      q: "martin",
      group: "ST",
      maxAge: "24",
      maxValue: "15",
      verdict: "Bargain",
      style: "gegenpress",
      sort: "value",
      dir: "asc",
    });
    const filters = parseScoutFilters(initial);
    expect(filters).toEqual({
      kind: "squad",
      q: "martin",
      group: "ST",
      maxAge: "24",
      maxValue: "15",
      verdict: "Bargain",
      fit: "all",
      style: "gegenpress",
      sort: "value",
      dir: "asc",
    });
    expect(serializeScoutFilters(filters)).toBe(
      "/scout?kind=squad&q=martin&group=ST&maxAge=24&maxValue=15&verdict=Bargain&style=gegenpress&sort=value",
    );
    expect(parseScoutFilters(new URLSearchParams(serializeScoutFilters(filters).split("?")[1] ?? ""))).toEqual(
      filters,
    );
  });

  it("defaults unknown params safely", () => {
    const filters = parseScoutFilters(new URLSearchParams({ group: "XX", sort: "nope", verdict: "Maybe", style: "nope" }));
    expect(filters.group).toBe("all");
    expect(filters.sort).toBe("reco");
    expect(filters.verdict).toBe("all");
    expect(filters.fit).toBe("all");
    expect(filters.style).toBe("all");
    expect(serializeScoutFilters(filters)).toBe("/scout");
  });

  it("bridges assistant scout filters into a desk URL", () => {
    const href = serializeAssistantScoutFilters({
      group: "DM/CM",
      maxAge: 24,
      maxValue: 20e6,
      style: "tiki-taka",
    });
    expect(href).toContain("group=DM%2FCM");
    expect(href).toContain("maxAge=24");
    expect(href).toContain("maxValue=20");
    expect(href).toContain("style=tiki-taka");
    expect(href).not.toBe("/scout");
  });

  it("builds style scout deep-links", () => {
    const href = scoutHrefForStyle("gegenpress");
    expect(href).toContain("style=gegenpress");
    expect(href).toContain("sort=fit");
  });
});
