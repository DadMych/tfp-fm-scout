import { describe, expect, it } from "vitest";
import { decodeExportText } from "../../src/import/decode.js";

describe("decodeExportText", () => {
  it("decodes UTF-8 text unchanged", () => {
    const bytes = new TextEncoder().encode("Player;Position\nAlpha;DM");
    expect(decodeExportText(bytes)).toBe("Player;Position\nAlpha;DM");
  });

  it("falls back from mojibake UTF-8 to Windows-1252", () => {
    const latin1 = new Uint8Array([0x50, 0x6c, 0x61, 0x79, 0x65, 0x72, 0x3b, 0xe9]);
    const decoded = decodeExportText(latin1);
    expect(decoded).toContain("é");
  });
});
