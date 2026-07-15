import { describe, it, expect } from "vitest";
import { parseExport } from "./parse.js";

/** Real FM26 export headers (subset): name is "Player", plus a "Best Position" fallback. */
const HEADER =
  "Player;Position;Best Position;Age;Club;Acceleration;Punching";

function csv(rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("parseExport — real FM26 format", () => {
  it("maps the 'Player' column to name and imports the row", () => {
    const { players, report } = parseExport(csv(["Alpha;DM, M (C);M (C);22;Team A;14;5"]));
    expect(players).toHaveLength(1);
    expect(players[0]!.name).toBe("Alpha");
    expect(players[0]!.positions).toEqual(["DM-C", "M-C"]);
    expect(report.rowsImported).toBe(1);
  });

  it("falls back to 'Best Position' when 'Position' is empty", () => {
    const { players } = parseExport(csv(["Bravo;;ST (C);25;Team B;12;3"]));
    expect(players[0]!.positions).toEqual(["ST-C"]);
  });

  it("maps 'Punching' to the punching attribute (parenthetical-stripped synonym)", () => {
    const { players } = parseExport(csv(["Keeper;GK;;30;Team C;10;9"]));
    expect(players[0]!.attrs.punching).toEqual({ min: 9, max: 9 });
  });

  it("collapses duplicate scrapes of the same identity", () => {
    const { players, report } = parseExport(
      csv([
        "Alpha;DM, M (C);M (C);22;Team A;14;5",
        "Alpha;DM, M (C);M (C);22;Team A;14;5",
      ]),
    );
    expect(players).toHaveLength(1);
    expect(report.rowsSkipped).toContainEqual({ row: 3, reason: "DUPLICATE" });
  });

  it("keeps a player with no parseable position (counted, not dropped)", () => {
    const { players, report } = parseExport(csv(["Nomad;;;24;Team D;13;4"]));
    expect(players).toHaveLength(1);
    expect(players[0]!.positions).toEqual([]);
    expect(report.rowsWithoutPosition).toBe(1);
  });

  it("parses transfer value (range midpoint), height, and preferred foot", () => {
    const header =
      "Player;Position;Age;Transfer Value;Height;Right Foot;Left Foot;Acceleration";
    const rows = [
      "Val;M (C);23;€56M - €82M;179 cm;Very Strong;Weak;14",
      "Lefty;M (C);24;€30M;182 cm;Reasonable;Very Strong;13",
      "Twofoot;M (C);25;;175 cm;Strong;Strong;12",
    ];
    const { players } = parseExport([header, ...rows].join("\n"));
    expect(players[0]!.value).toBe(69e6);
    expect(players[0]!.heightCm).toBe(179);
    expect(players[0]!.foot).toBe("Right");
    expect(players[1]!.value).toBe(30e6);
    expect(players[1]!.foot).toBe("Left");
    expect(players[2]!.value).toBeNull();
    expect(players[2]!.foot).toBe("Either");
  });

  it("parses the FM letter grade, ignores junk, and keeps the first valid of duplicate columns", () => {
    const header = "Player;Position;Age;Recommendation;Acceleration;Recommendation";
    const rows = [
      "Graded;M (C);23;A-;14;Scouting Required", // valid grade wins over junk 2nd column
      "Junk;M (C);24;Unknown;13;Practical", // no valid grade anywhere
    ];
    const { players } = parseExport([header, ...rows].join("\n"));
    expect(players[0]!.scoutGrade).toBe("A-");
    expect(players[1]!.scoutGrade).toBeNull();
  });

  it("never silently drops a row: rowsTotal == imported + skipped", () => {
    const { report } = parseExport(
      csv([
        "Alpha;DM, M (C);M (C);22;Team A;14;5",
        ";;;;;;", // missing name
        "Alpha;DM, M (C);M (C);22;Team A;14;5", // duplicate
        "Bravo;ST (C);ST (C);25;Team B;12;3",
      ]),
    );
    expect(report.rowsTotal).toBe(report.rowsImported + report.rowsSkipped.length);
  });
});
