import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildInMemoryStore } from "./store.js";

const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function seed() {
  const s = buildInMemoryStore();
  return s;
}

describe("InviteStore · address-keyed access", () => {
  it("getByAddress is null on a fresh store", async () => {
    const s = seed();
    assert.equal(await s.getByAddress(ALICE), null);
  });

  it("insert + getByAddress roundtrips", async () => {
    const s = seed();
    const row = await s.insertRequest({
      address: ALICE,
      email: "alice@example.com",
      telegram: "@alice",
      ip: "1.2.3.4",
    });
    assert.equal(row.address, ALICE);
    assert.equal(row.id, 1);
    assert.equal(row.status, "pending");

    const fetched = await s.getByAddress(ALICE);
    assert.deepEqual(fetched, row);
  });

  it("getByAddress is case-insensitive", async () => {
    const s = seed();
    await s.insertRequest({
      address: ALICE,
      email: "a@e",
      telegram: "@a",
      ip: null,
    });
    const upper = await s.getByAddress(ALICE.toUpperCase());
    assert.ok(upper);
    assert.equal(upper.address, ALICE);
  });
});

describe("InviteStore · index", () => {
  it("nextId increments across inserts", async () => {
    const s = seed();
    const r1 = await s.insertRequest({
      address: ALICE,
      email: "a@e.com",
      telegram: "@a",
      ip: null,
    });
    const r2 = await s.insertRequest({
      address: BOB,
      email: "b@e.com",
      telegram: "@b",
      ip: null,
    });
    assert.equal(r1.id, 1);
    assert.equal(r2.id, 2);
  });

  it("list filters by status and sorts desc by createdAt", async () => {
    const s = seed();
    await s.insertRequest({
      address: ALICE,
      email: "a@e.com",
      telegram: "@a",
      ip: null,
    });
    await new Promise((r) => setTimeout(r, 5));
    await s.insertRequest({
      address: BOB,
      email: "b@e.com",
      telegram: "@b",
      ip: null,
    });
    const all = await s.list({ status: "all", limit: 10, offset: 0 });
    assert.equal(all.length, 2);
    assert.equal(all[0].address, BOB); // newest first
    assert.equal(all[1].address, ALICE);

    await s.approve(ALICE);
    const approved = await s.list({ status: "approved", limit: 10, offset: 0 });
    assert.equal(approved.length, 1);
    assert.equal(approved[0].address, ALICE);
  });

  it("count by status reflects state changes", async () => {
    const s = seed();
    await s.insertRequest({ address: ALICE, email: "a@e.com", telegram: "@a", ip: null });
    await s.insertRequest({ address: BOB, email: "b@e.com", telegram: "@b", ip: null });
    assert.equal(await s.count({ status: "pending" }), 2);
    await s.approve(ALICE);
    assert.equal(await s.count({ status: "pending" }), 1);
    assert.equal(await s.count({ status: "approved" }), 1);
    assert.equal(await s.count({ status: "all" }), 2);
  });
});

describe("InviteStore · approve / reject / remove", () => {
  it("approve flips status and persists in both record and index", async () => {
    const s = seed();
    await s.insertRequest({ address: ALICE, email: "a@e.com", telegram: "@a", ip: null });
    const updated = await s.approve(ALICE);
    assert.ok(updated);
    assert.equal(updated.status, "approved");

    const fromRecord = await s.getByAddress(ALICE);
    assert.equal(fromRecord?.status, "approved");

    const fromIndex = (await s.list({ status: "approved", limit: 10, offset: 0 }))[0];
    assert.equal(fromIndex.address, ALICE);
    assert.equal(fromIndex.status, "approved");
  });

  it("reject persists notes", async () => {
    const s = seed();
    await s.insertRequest({ address: ALICE, email: "a@e.com", telegram: "@a", ip: null });
    const updated = await s.reject(ALICE, "spam pattern");
    assert.equal(updated?.status, "rejected");
    assert.equal(updated?.notes, "spam pattern");
    const fromRecord = await s.getByAddress(ALICE);
    assert.equal(fromRecord?.notes, "spam pattern");
  });

  it("approve on missing address returns null", async () => {
    const s = seed();
    assert.equal(await s.approve(ALICE), null);
  });

  it("remove drops both record and index entry", async () => {
    const s = seed();
    await s.insertRequest({ address: ALICE, email: "a@e.com", telegram: "@a", ip: null });
    assert.equal(await s.remove(ALICE), true);
    assert.equal(await s.getByAddress(ALICE), null);
    assert.equal(await s.count({ status: "all" }), 0);
  });

  it("remove on missing address returns false", async () => {
    const s = seed();
    assert.equal(await s.remove(ALICE), false);
  });
});

describe("InviteStore · queries", () => {
  it("findActiveByEmailOrAddress matches pending and approved", async () => {
    const s = seed();
    await s.insertRequest({
      address: ALICE,
      email: "alice@example.com",
      telegram: "@a",
      ip: null,
    });
    const byAddr = await s.findActiveByEmailOrAddress("noone@x", ALICE);
    assert.ok(byAddr);
    const byEmail = await s.findActiveByEmailOrAddress("ALICE@example.com", BOB);
    assert.ok(byEmail);
    await s.reject(ALICE, null);
    const after = await s.findActiveByEmailOrAddress("alice@example.com", ALICE);
    assert.equal(after, null); // rejected entries don't block
  });

  it("countRecentByIp counts records since the cutoff", async () => {
    const s = seed();
    await s.insertRequest({ address: ALICE, email: "a@e.com", telegram: "@a", ip: "1.1.1.1" });
    await s.insertRequest({ address: BOB, email: "b@e.com", telegram: "@b", ip: "1.1.1.1" });
    const since = Date.now() - 60_000;
    assert.equal(await s.countRecentByIp("1.1.1.1", since), 2);
    assert.equal(await s.countRecentByIp("9.9.9.9", since), 0);
  });
});
