import { describe, it, expect } from "vitest";
import { esc, footLabel, formatHeight, formatMoney, metricLabel, ordinal } from "./format.js";

describe("format helpers", () => {
  it("formats money compactly with a currency prefix", () => {
    expect(formatMoney(69e6)).toBe("€69M");
    expect(formatMoney(8.5e6)).toBe("€8.5M");
    expect(formatMoney(500e3)).toBe("€500K");
    expect(formatMoney(1.2e9)).toBe("€1.2B");
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });

  it("formats height and foot, with dashes for unknowns", () => {
    expect(formatHeight(179)).toBe("179 cm");
    expect(formatHeight(null)).toBe("—");
    expect(footLabel("Right")).toBe("Right foot");
    expect(footLabel("Either")).toBe("Both feet");
    expect(footLabel(null)).toBe("—");
  });

  it("produces correct ordinals across the teens/tens edge cases", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(100)).toBe("100th");
  });

  it("labels metrics from attribute and derived ids", () => {
    expect(metricLabel("finishing")).toBe("Finishing");
    expect(metricLabel("pressResist")).toBe("Press-resistance");
    expect(metricLabel("unknownId")).toBe("unknownId");
  });

  it("escapes HTML metacharacters", () => {
    expect(esc('<a>&"')).toBe("&lt;a&gt;&amp;&quot;");
  });
});
