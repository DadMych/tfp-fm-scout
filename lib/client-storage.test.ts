import { describe, expect, it } from "vitest";
import { migrateLegacyWatchIds } from "./client-storage";
import { playerIdentityKey } from "../src/domain/player-identity.js";
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

describe("migrateLegacyWatchIds", () => {
  it("maps v1 id list to identity-keyed entries from datasets", () => {
    const p = stub({ id: "shortlist-3", name: "Alex Keeper" });
    const migrated = migrateLegacyWatchIds(["shortlist-3", "missing"], {
      shortlist: { players: [p] },
    });
    expect(migrated).toHaveLength(1);
    expect(migrated[0]!.identityKey).toBe(playerIdentityKey(p));
    expect(migrated[0]!.status).toBe("watching");
  });

  it("prefers shortlist over squad when both contain the id", () => {
    const short = stub({ id: "dup-1", name: "Shortlist Player" });
    const squad = stub({ id: "dup-1", name: "Squad Player" });
    const migrated = migrateLegacyWatchIds(["dup-1"], {
      shortlist: { players: [short] },
      squad: { players: [squad] },
    });
    expect(migrated).toHaveLength(1);
    expect(migrated[0]!.identityKey).toBe(playerIdentityKey(short));
  });
});
