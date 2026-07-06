import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { buildApp } from "./app.js";
import { buildInMemoryProjectUpdateReactionStore } from "./project-updates-store.js";
import { buildProjectUpdateReactionMessage } from "./project-updates.js";

const TEST_KEY =
  "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
const account = privateKeyToAccount(TEST_KEY);
const ALICE = account.address.toLowerCase();
const CAMPAIGN = "0x1111111111111111111111111111111111111111";

function buildTestApp() {
  const store = buildInMemoryProjectUpdateReactionStore();
  const puts: Array<{ input: unknown }> = [];
  return {
    store,
    puts,
    app: buildApp({
      config: {
        spacesBucket: "test",
        spacesPublicBase: "https://cdn.growfi.test",
        hasCredentials: true,
      },
      putObject: async (cmd) => {
        puts.push({ input: cmd.input });
        return {};
      },
      projectUpdateReactionStore: store,
      signatureMaxAgeMs: 60_000,
    }),
  };
}

async function signedReaction(emoji: string, opts?: { campaign?: string; updateId?: string }) {
  const issuedAt = new Date().toISOString();
  const nonce = "abc123";
  const payload = {
    campaign: (opts?.campaign ?? CAMPAIGN).toLowerCase(),
    updateId: opts?.updateId ?? "1",
    address: ALICE,
    emoji,
    issuedAt,
    nonce,
  };
  const message = buildProjectUpdateReactionMessage(payload);
  const signature = await account.signMessage({ message });
  return { ...payload, signature };
}

describe("project updates · metadata", () => {
  it("uploads canonical JSON and returns its content hash", async () => {
    const { app, puts } = buildTestApp();
    const res = await (await app).inject({
      method: "POST",
      url: "/api/project-updates/metadata",
      payload: {
        campaign: CAMPAIGN,
        title: "First harvest walk",
        body: "<p>Rows inspected.</p>",
        imageUrl: "https://cdn.growfi.test/photo.jpg",
      },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.metadata.schema, "growfi.project-update.v1");
    assert.equal(body.metadata.campaign, CAMPAIGN);
    assert.match(body.contentHash, /^0x[0-9a-f]{64}$/);
    assert.equal(puts.length, 1);
  });
});

describe("project updates · reactions", () => {
  it("returns an empty summary", async () => {
    const { app } = buildTestApp();
    const res = await (await app).inject({
      method: "GET",
      url: `/api/project-updates/${CAMPAIGN}/1/reactions?address=${ALICE}`,
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().counts, {});
    assert.equal(res.json().viewerEmoji, null);
  });

  it("saves and removes a valid signed reaction", async () => {
    const { app } = buildTestApp();
    const save = await (await app).inject({
      method: "PUT",
      url: `/api/project-updates/${CAMPAIGN}/1/reactions/me`,
      payload: await signedReaction("🌱"),
    });
    assert.equal(save.statusCode, 200);
    assert.equal(save.json().counts["🌱"], 1);
    assert.equal(save.json().viewerEmoji, "🌱");

    const remove = await (await app).inject({
      method: "PUT",
      url: `/api/project-updates/${CAMPAIGN}/1/reactions/me`,
      payload: await signedReaction(""),
    });
    assert.equal(remove.statusCode, 200);
    assert.deepEqual(remove.json().counts, {});
    assert.equal(remove.json().viewerEmoji, null);
  });

  it("rejects unsupported emoji and mismatched signatures", async () => {
    const { app } = buildTestApp();
    const badEmoji = await (await app).inject({
      method: "PUT",
      url: `/api/project-updates/${CAMPAIGN}/1/reactions/me`,
      payload: await signedReaction("💩"),
    });
    assert.equal(badEmoji.statusCode, 400);

    const payload = await signedReaction("🔥");
    const tampered = await (await app).inject({
      method: "PUT",
      url: `/api/project-updates/${CAMPAIGN}/1/reactions/me`,
      payload: { ...payload, emoji: "👍" },
    });
    assert.equal(tampered.statusCode, 401);
  });
});
