import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildInMemoryNotificationStore } from "./notifications-store.js";

const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const ALICE_MIXED = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function fixture() {
  return {
    address: ALICE,
    email: "alice@growfi.dev",
    optedIn: true,
    signedMessage: "GrowFi notifications\nAddress: 0x...\n…",
    signature: "0xdeadbeef",
    signedAt: 1_700_000_000_000,
  };
}

describe("NotificationStore · CRUD", () => {
  it("getByAddress is null on a fresh store", async () => {
    const s = buildInMemoryNotificationStore();
    assert.equal(await s.getByAddress(ALICE), null);
  });

  it("upsert inserts a fresh record", async () => {
    const s = buildInMemoryNotificationStore();
    const row = await s.upsert(fixture());
    assert.equal(row.address, ALICE);
    assert.equal(row.email, "alice@growfi.dev");
    assert.equal(row.optedIn, true);
    assert.ok(row.createdAt > 0);
    assert.equal(row.createdAt, row.updatedAt);
  });

  it("upsert updates email/optIn while preserving createdAt", async () => {
    const s = buildInMemoryNotificationStore();
    const a = await s.upsert(fixture());
    await new Promise((r) => setTimeout(r, 5));
    const b = await s.upsert({
      ...fixture(),
      email: "alice2@growfi.dev",
      optedIn: false,
    });
    assert.equal(b.email, "alice2@growfi.dev");
    assert.equal(b.optedIn, false);
    assert.equal(b.createdAt, a.createdAt, "createdAt is sticky");
    assert.ok(b.updatedAt >= a.updatedAt);
  });

  it("getByAddress is case-insensitive", async () => {
    const s = buildInMemoryNotificationStore();
    await s.upsert(fixture());
    const r = await s.getByAddress(ALICE_MIXED);
    assert.ok(r);
    assert.equal(r!.address, ALICE);
  });

  it("listOptedIn excludes opted-out and missing rows", async () => {
    const s = buildInMemoryNotificationStore();
    await s.upsert(fixture());
    await s.upsert({ ...fixture(), address: BOB, optedIn: false });
    const list = await s.listOptedIn();
    assert.equal(list.length, 1);
    assert.equal(list[0]!.address, ALICE);
  });

  it("remove deletes the record + index entry", async () => {
    const s = buildInMemoryNotificationStore();
    await s.upsert(fixture());
    assert.equal(await s.remove(ALICE), true);
    assert.equal(await s.getByAddress(ALICE), null);
    assert.equal((await s.listOptedIn()).length, 0);
    assert.equal(await s.remove(ALICE), false, "second remove returns false");
  });
});

describe("NotificationStore · cursor", () => {
  it("loadCursor returns zeros on a fresh store", async () => {
    const s = buildInMemoryNotificationStore();
    const c = await s.loadCursor();
    assert.equal(c.lastPurchaseBlock, 0);
    assert.equal(c.lastSeasonEndedTs, 0);
    assert.equal(c.lastSeasonReportedTs, 0);
    assert.equal(c.lastClaimCommittedTs, 0);
  });

  it("saveCursor + loadCursor roundtrips", async () => {
    const s = buildInMemoryNotificationStore();
    await s.saveCursor({
      lastPurchaseBlock: 12345,
      lastSeasonEndedTs: 1_700_000_000,
      lastSeasonReportedTs: 1_700_000_001,
      lastClaimCommittedTs: 1_700_000_002,
      updatedAt: 1_700_000_003_000,
    });
    const c = await s.loadCursor();
    assert.equal(c.lastPurchaseBlock, 12345);
    assert.equal(c.lastSeasonEndedTs, 1_700_000_000);
    assert.equal(c.lastClaimCommittedTs, 1_700_000_002);
  });
});
