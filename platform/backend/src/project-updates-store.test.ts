import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildInMemoryProjectUpdateReactionStore } from "./project-updates-store.js";

const CAMPAIGN = "0x1111111111111111111111111111111111111111";
const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("ProjectUpdateReactionStore", () => {
  it("returns an empty record when no reactions exist", async () => {
    const store = buildInMemoryProjectUpdateReactionStore();
    const record = await store.get(CAMPAIGN, "1");
    assert.equal(record.campaign, CAMPAIGN);
    assert.equal(record.updateId, "1");
    assert.deepEqual(record.reactions, []);
  });

  it("sets, overwrites, and removes one reaction per wallet", async () => {
    const store = buildInMemoryProjectUpdateReactionStore();
    await store.set({ campaign: CAMPAIGN, updateId: "1", address: ALICE, emoji: "👍" });
    await store.set({ campaign: CAMPAIGN, updateId: "1", address: BOB, emoji: "🌱" });
    let record = await store.set({
      campaign: CAMPAIGN,
      updateId: "1",
      address: ALICE,
      emoji: "🔥",
    });
    assert.equal(record.reactions.length, 2);
    assert.equal(record.reactions.find((r) => r.address === ALICE)?.emoji, "🔥");

    record = await store.remove({ campaign: CAMPAIGN, updateId: "1", address: ALICE });
    assert.equal(record.reactions.length, 1);
    assert.equal(record.reactions[0].address, BOB);
  });
});
