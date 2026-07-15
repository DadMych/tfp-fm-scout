import { describe, expect, it } from "vitest";
import { findPlayerByIdentity, playerIdentityKey } from "./player-identity.js";
import type { Player } from "./player.js";

function stub(over: Partial<Player> & Pick<Player, "id" | "name">): Player {
  return {
    age: 24,
    nationality: "England",
    positions: ["ST-C"],
    attrs: {},
    ...over,
  };
}

describe("playerIdentityKey", () => {
  it("matches the same player after id and age change on re-import", () => {
    const before = stub({ id: "shortlist-5", name: "Marcus Test", nationality: "England", age: 22 });
    const after = stub({ id: "shortlist-99", name: "Marcus Test", nationality: "England", age: 23 });
    expect(playerIdentityKey(before)).toBe(playerIdentityKey(after));
    expect(findPlayerByIdentity([after], playerIdentityKey(before))).toBe(after);
  });

  it("does not merge distinct namesakes", () => {
    const a = stub({ id: "1", name: "Smith", nationality: "England", age: 20 });
    const b = stub({ id: "2", name: "Smith", nationality: "France", age: 20 });
    expect(playerIdentityKey(a)).not.toBe(playerIdentityKey(b));
  });
});
