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

  it("parses wage, contract, loan, fee, flags, preferred foot, and style columns", () => {
    const header =
      "Inf;Player;Style;Position;Age;Wage;Expires;Preferred Foot;Loan Duration;On Loan From;Last Transfer Fee;Acceleration;Agility;Balance;Jumping Reach;Natural Fitness;Pace;Stamina;Strength;Corners;Crossing;Dribbling;Finishing;First Touch;Heading;Long Shots;Marking;Passing;Tackling;Technique;Aggression;Anticipation";
    const rows = [
      "Inj;Loanee;Creative;M (C);23;€27K p/w;30/6/2028;Left-Footed;14/7/25 - 30/6/26;Barcelona;€11.18M;14;13;12;11;14;13;15;14;12;8;9;11;10;12;10;11;12;13;14;15;12;13",
      "Wnt, Loa;Owned;Physical;M (C);24;€4K p/w;30/6/2026;Right-Footed;-;;(€1);13;12;11;10;13;12;14;13;11;7;8;10;11;11;9;10;11;12;13;14;12;11",
    ];
    const { players } = parseExport([header, ...rows].join("\n"));
    const loanee = players[0]!;
    expect(loanee.wage).toBe(27000);
    expect(loanee.contractExpires).toBe("2028-06-30");
    expect(loanee.foot).toBe("Left");
    expect(loanee.loanEnd).toBe("2026-06-30");
    expect(loanee.onLoanFrom).toBe("Barcelona");
    expect(loanee.lastTransferFee).toBe(11.18e6);
    expect(loanee.flags).toEqual(["injured"]);
    expect(loanee.playStyle).toBe("Creative");

    const owned = players[1]!;
    expect(owned.wage).toBe(4000);
    expect(owned.contractExpires).toBe("2026-06-30");
    expect(owned.foot).toBe("Right");
    expect(owned.loanEnd).toBeNull();
    expect(owned.onLoanFrom).toBeNull();
    expect(owned.lastTransferFee).toBeNull(); // "(€1)" is a loan nominal, not a fee
    expect(owned.flags).toEqual(["wanted", "loan-listed"]);
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
