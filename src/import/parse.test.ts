import { describe, it, expect } from "vitest";
import { parseExport } from "./parse.js";

/** Enough mapped attributes for the §5 minimum (name + positions + ≥20 attrs). */
const HEADER =
  "Player;Position;Best Position;Age;Club;Acceleration;Agility;Balance;Jumping Reach;Natural Fitness;Pace;Stamina;Strength;Corners;Crossing;Dribbling;Finishing;First Touch;Heading;Long Shots;Marking;Passing;Tackling;Technique;Aggression;Anticipation;Punching";

function csv(rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

function padRow(cells: string[]): string {
  const need = HEADER.split(";").length;
  while (cells.length < need) cells.push("");
  return cells.join(";");
}

describe("parseExport — real FM26 format", () => {
  it("maps the 'Player' column to name and imports the row", () => {
    const { players, report } = parseExport(
      csv([padRow(["Alpha", "DM, M (C)", "M (C)", "22", "Team A", "14", "13", "12", "11", "14", "13", "15", "14", "12", "8", "9", "11", "10", "15", "10", "12", "13", "16", "14", "15", "12", "13", "5"])]),
    );
    expect(players).toHaveLength(1);
    expect(players[0]!.name).toBe("Alpha");
    expect(players[0]!.positions).toEqual(["DM-C", "M-C"]);
    expect(report.rowsImported).toBe(1);
    expect(report.parserVersion).toBeTruthy();
  });

  it("falls back to 'Best Position' when 'Position' is empty", () => {
    const { players } = parseExport(csv([padRow(["Bravo", "", "ST (C)", "25", "Team B", "12", "11", "10", "9", "13", "12", "14", "13", "11", "7", "8", "10", "11", "12", "9", "10", "11", "12", "13", "14", "12", "3"])]));
    expect(players[0]!.positions).toEqual(["ST-C"]);
  });

  it("maps 'Punching' to the punching attribute (parenthetical-stripped synonym)", () => {
    const { players } = parseExport(csv([padRow(["Keeper", "GK", "", "30", "Team C", "10", "9", "8", "7", "12", "8", "11", "10", "3", "4", "5", "3", "6", "5", "4", "8", "7", "6", "9", "8", "7", "9"])]));
    expect(players[0]!.attrs.punching).toEqual({ min: 9, max: 9 });
  });

  it("collapses duplicate scrapes of the same identity", () => {
    const row = padRow(["Alpha", "DM, M (C)", "M (C)", "22", "Team A", "14", "13", "12", "11", "14", "13", "15", "14", "12", "8", "9", "11", "10", "15", "10", "12", "13", "16", "14", "15", "12", "13", "5"]);
    const { players, report } = parseExport(csv([row, row]));
    expect(players).toHaveLength(1);
    expect(report.rowsSkipped).toContainEqual({ row: 3, reason: "DUPLICATE" });
  });

  it("keeps a player with no parseable position (counted, not dropped)", () => {
    const { players, report } = parseExport(csv([padRow(["Nomad", "", "", "24", "Team D", "13", "12", "11", "10", "14", "13", "15", "14", "12", "8", "9", "11", "10", "12", "10", "11", "12", "13", "14", "15", "12", "4"])]));
    expect(players).toHaveLength(1);
    expect(players[0]!.positions).toEqual([]);
    expect(report.rowsWithoutPosition).toBe(1);
  });

  it("parses transfer value (range midpoint), height, and preferred foot", () => {
    const header =
      "Player;Position;Age;Transfer Value;Height;Right Foot;Left Foot;Acceleration;Agility;Balance;Jumping Reach;Natural Fitness;Pace;Stamina;Strength;Corners;Crossing;Dribbling;Finishing;First Touch;Heading;Long Shots;Marking;Passing;Tackling;Technique;Aggression;Anticipation";
    const rows = [
      "Val;M (C);23;€56M - €82M;179 cm;Very Strong;Weak;14;13;12;11;14;13;15;14;12;8;9;11;10;12;10;11;12;13;14;15;12;13",
      "Lefty;M (C);24;€30M;182 cm;Reasonable;Very Strong;13;12;11;10;13;12;14;13;11;7;8;10;11;11;9;10;11;12;13;14;12;11",
      "Twofoot;M (C);25;;175 cm;Strong;Strong;12;11;10;9;12;11;13;12;10;6;7;9;10;10;8;9;10;11;12;13;11;10",
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
    const header =
      "Player;Position;Age;Recommendation;Acceleration;Agility;Balance;Jumping Reach;Natural Fitness;Pace;Stamina;Strength;Corners;Crossing;Dribbling;Finishing;First Touch;Heading;Long Shots;Marking;Passing;Tackling;Technique;Aggression;Anticipation;Recommendation";
    const rows = [
      "Graded;M (C);23;A-;14;13;12;11;14;13;15;14;12;8;9;11;10;12;10;11;12;13;14;15;12;Scouting Required",
      "Junk;M (C);24;Unknown;13;12;11;10;13;12;14;13;11;7;8;10;11;11;9;10;11;12;13;14;12;Practical",
    ];
    const { players } = parseExport([header, ...rows].join("\n"));
    expect(players[0]!.scoutGrade).toBe("A-");
    expect(players[1]!.scoutGrade).toBeNull();
  });

  it("reports BAD_ATTRIBUTE_VALUE for junk attribute cells", () => {
    const row = padRow(["Bad", "M (C)", "M (C)", "22", "Team A", "nope", "13", "12", "11", "14", "13", "15", "14", "12", "8", "9", "11", "10", "15", "10", "12", "13", "16", "14", "15", "12", "13", "5"]);
    const { report } = parseExport(csv([row]));
    expect(report.cellIssues.BAD_ATTRIBUTE_VALUE).toBe(1);
  });

  it("never silently drops a row: rowsTotal == imported + skipped", () => {
    const good = padRow(["Alpha", "DM, M (C)", "M (C)", "22", "Team A", "14", "13", "12", "11", "14", "13", "15", "14", "12", "8", "9", "11", "10", "15", "10", "12", "13", "16", "14", "15", "12", "13", "5"]);
    const { report } = parseExport(
      csv([good, padRow(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]), good, padRow(["Bravo", "ST (C)", "ST (C)", "25", "Team B", "12", "11", "10", "9", "13", "12", "14", "13", "11", "7", "8", "10", "11", "12", "9", "10", "11", "12", "13", "14", "12", "3"])]),
    );
    expect(report.rowsTotal).toBe(report.rowsImported + report.rowsSkipped.length);
  });
});
