import { describe, it, expect } from "vitest";
import type { Player } from "../player.js";
import {
  contractExpiring,
  contractPenultimate,
  loanStatusOf,
  ourClubOf,
  seasonEndOf,
  shortDate,
} from "./status.js";

function p(extra: Partial<Player>): Player {
  return {
    id: extra.id ?? "x",
    name: "X",
    age: 25,
    positions: ["ST-C"],
    attrs: {},
    ...extra,
  };
}

describe("ourClubOf", () => {
  it("picks the modal club, counting On Loan From for players parked elsewhere", () => {
    const players = [
      p({ club: "Girona" }),
      p({ club: "Girona" }),
      p({ club: "Girona", onLoanFrom: "Barcelona" }), // loaned in
      p({ club: "Wolves", onLoanFrom: "Girona" }), // loaned out
      p({ club: "Cádiz", onLoanFrom: "Girona" }), // loaned out
    ];
    expect(ourClubOf(players)).toBe("Girona");
  });

  it("returns null when no club data exists", () => {
    expect(ourClubOf([p({}), p({})])).toBeNull();
  });
});

describe("loanStatusOf", () => {
  it("classifies loan direction from the owning club", () => {
    const ours = "Girona";
    expect(loanStatusOf(p({ club: "Girona", onLoanFrom: "Barcelona" }), ours)).toBe("loaned-in");
    expect(loanStatusOf(p({ club: "Wolves", onLoanFrom: "Girona" }), ours)).toBe("loaned-out");
    expect(loanStatusOf(p({ club: "Girona" }), ours)).toBeNull();
  });

  it("treats any loanee as loaned-in when our club is unknown", () => {
    expect(loanStatusOf(p({ onLoanFrom: "Barcelona" }), null)).toBe("loaned-in");
  });
});

describe("season end + contract windows", () => {
  const squad = [
    p({ contractExpires: "2027-06-30" }),
    p({ contractExpires: "2026-06-30" }),
    p({ loanEnd: "2026-06-30" }),
  ];
  const seasonEnd = seasonEndOf(squad);

  it("season end is the earliest expiry or loan end", () => {
    expect(seasonEnd).toBe("2026-06-30");
  });

  it("expiring: contract ends at or before the season end", () => {
    expect(contractExpiring(p({ contractExpires: "2026-06-30" }), seasonEnd)).toBe(true);
    expect(contractExpiring(p({ contractExpires: "2027-06-30" }), seasonEnd)).toBe(false);
    expect(contractExpiring(p({}), seasonEnd)).toBe(false);
  });

  it("penultimate: one season beyond the coming end, not already expiring", () => {
    expect(contractPenultimate(p({ contractExpires: "2027-06-30" }), seasonEnd)).toBe(true);
    expect(contractPenultimate(p({ contractExpires: "2026-06-30" }), seasonEnd)).toBe(false);
    expect(contractPenultimate(p({ contractExpires: "2028-06-30" }), seasonEnd)).toBe(false);
  });
});

describe("shortDate", () => {
  it("renders compact FM-style dates", () => {
    expect(shortDate("2026-06-30")).toBe("30/6/26");
  });
});
