import { describe, expect, it } from "vitest";
import { createWatchEntry, resolveWatchEntries } from "./watch-list";
import type { Player } from "../src/domain/player.js";

function stub(over: Partial<Player> & Pick<Player, "id" | "name">): Player {
  return {
    age: 22,
    nationality: "England",
    positions: ["ST-C"],
    attrs: {},
    ...over,
  };
}

describe("watch list resolve", () => {
  it("survives re-upload when player id changes", () => {
    const before = stub({ id: "shortlist-5", name: "Marcus Test" });
    const after = stub({ id: "shortlist-88", name: "Marcus Test", age: 23 });
    const entry = createWatchEntry(before, "pursue");
    const resolved = resolveWatchEntries([entry], [after], null);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.id).toBe("shortlist-88");
    expect(resolved[0]!.entry.status).toBe("pursue");
  });
});
