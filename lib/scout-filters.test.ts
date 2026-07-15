import { describe, expect, it } from "vitest";
import { parseScoutFilters, serializeScoutFilters } from "./scout-filters";

describe("scout filters URL", () => {
  it("round-trips a filtered desk URL", () => {
    const initial = new URLSearchParams({
      kind: "squad",
      q: "martin",
      group: "ST",
      maxAge: "24",
      maxValue: "15",
      verdict: "Bargain",
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
      sort: "value",
      dir: "asc",
    });
    expect(serializeScoutFilters(filters)).toBe(
      "/scout?kind=squad&q=martin&group=ST&maxAge=24&maxValue=15&verdict=Bargain&sort=value",
    );
    expect(parseScoutFilters(new URLSearchParams(serializeScoutFilters(filters).split("?")[1] ?? ""))).toEqual(
      filters,
    );
  });

  it("defaults unknown params safely", () => {
    const filters = parseScoutFilters(new URLSearchParams({ group: "XX", sort: "nope", verdict: "Maybe" }));
    expect(filters.group).toBe("all");
    expect(filters.sort).toBe("reco");
    expect(filters.verdict).toBe("all");
    expect(filters.fit).toBe("all");
    expect(serializeScoutFilters(filters)).toBe("/scout");
  });
});
