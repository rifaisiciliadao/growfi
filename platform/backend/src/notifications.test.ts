import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { buildApp } from "./app.js";
import { buildInMemoryNotificationStore } from "./notifications-store.js";
import { buildNoopSender } from "./email.js";
import { buildSignedMessage } from "./notifications.js";

const TEST_KEY =
  "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
const account = privateKeyToAccount(TEST_KEY);
const ALICE = account.address.toLowerCase();
const UNSUB_SECRET = "test-unsub-secret";

function buildTestApp(opts?: { signatureMaxAgeMs?: number }) {
  const store = buildInMemoryNotificationStore();
  const email = buildNoopSender();
  return {
    store,
    app: buildApp({
      config: {
        spacesBucket: "test",
        spacesPublicBase: "https://test.invalid",
        hasCredentials: false,
      },
      putObject: async () => undefined,
      notificationStore: store,
      email,
      appUrl: "https://growfi.test",
      notificationsUnsubSecret: UNSUB_SECRET,
      ...opts,
    }),
  };
}

async function signSavePayload(opts: {
  email: string;
  optedIn: boolean;
  issuedAt?: string;
  nonce?: string;
}) {
  const issuedAt = opts.issuedAt ?? new Date().toISOString();
  const nonce = opts.nonce ?? "abc123";
  const message = buildSignedMessage({
    address: ALICE,
    email: opts.email,
    optedIn: opts.optedIn,
    issuedAt,
    nonce,
  });
  const signature = await account.signMessage({ message });
  return {
    address: ALICE,
    email: opts.email,
    optedIn: opts.optedIn,
    issuedAt,
    nonce,
    signature,
  };
}

describe("notifications · GET /api/notifications/me", () => {
  it("returns optedIn:false on unknown address", async () => {
    const { app } = buildTestApp();
    const res = await (await app).inject({
      method: "GET",
      url: `/api/notifications/me?address=${ALICE}`,
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.optedIn, false);
    assert.equal(body.hasEmail, false);
  });

  it("rejects a malformed address", async () => {
    const { app } = buildTestApp();
    const res = await (await app).inject({
      method: "GET",
      url: `/api/notifications/me?address=not-an-address`,
    });
    assert.equal(res.statusCode, 400);
  });

  it("never leaks the email itself", async () => {
    const { app, store } = buildTestApp();
    await store.upsert({
      address: ALICE,
      email: "alice@example.com",
      optedIn: true,
      signedMessage: "x",
      signature: "0x",
      signedAt: Date.now(),
    });
    const res = await (await app).inject({
      method: "GET",
      url: `/api/notifications/me?address=${ALICE}`,
    });
    const body = res.json();
    assert.equal(body.optedIn, true);
    assert.equal(body.hasEmail, true);
    assert.equal(body.email, undefined, "email field is never returned");
  });
});

describe("notifications · PUT /api/notifications/me (signed)", () => {
  it("saves a valid signed payload", async () => {
    const { app, store } = buildTestApp();
    const payload = await signSavePayload({
      email: "alice@example.com",
      optedIn: true,
    });
    const res = await (await app).inject({
      method: "PUT",
      url: "/api/notifications/me",
      payload,
    });
    assert.equal(res.statusCode, 200);
    const row = await store.getByAddress(ALICE);
    assert.equal(row!.email, "alice@example.com");
    assert.equal(row!.optedIn, true);
  });

  it("rejects when the signature was forged for another address", async () => {
    const { app } = buildTestApp();
    const payload = await signSavePayload({
      email: "alice@example.com",
      optedIn: true,
    });
    // Tamper: claim a different address than the one that signed.
    payload.address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const res = await (await app).inject({
      method: "PUT",
      url: "/api/notifications/me",
      payload,
    });
    assert.equal(res.statusCode, 401);
  });

  it("rejects when the email was tampered after signing", async () => {
    const { app } = buildTestApp();
    const payload = await signSavePayload({
      email: "alice@example.com",
      optedIn: true,
    });
    payload.email = "evil@example.com";
    const res = await (await app).inject({
      method: "PUT",
      url: "/api/notifications/me",
      payload,
    });
    // Recovery yields a different address than the claim → 401.
    assert.equal(res.statusCode, 401);
  });

  it("rejects an expired signature", async () => {
    const { app } = buildTestApp({ signatureMaxAgeMs: 1000 });
    const oldIssuedAt = new Date(Date.now() - 60_000).toISOString();
    const payload = await signSavePayload({
      email: "alice@example.com",
      optedIn: true,
      issuedAt: oldIssuedAt,
    });
    const res = await (await app).inject({
      method: "PUT",
      url: "/api/notifications/me",
      payload,
    });
    assert.equal(res.statusCode, 400);
  });

  it("rejects opt-in without a valid email", async () => {
    const { app } = buildTestApp();
    const payload = await signSavePayload({
      email: "not-an-email",
      optedIn: true,
    });
    const res = await (await app).inject({
      method: "PUT",
      url: "/api/notifications/me",
      payload,
    });
    assert.equal(res.statusCode, 400);
  });

  it("allows opt-out with an empty email", async () => {
    const { app, store } = buildTestApp();
    const payload = await signSavePayload({
      email: "",
      optedIn: false,
    });
    const res = await (await app).inject({
      method: "PUT",
      url: "/api/notifications/me",
      payload,
    });
    assert.equal(res.statusCode, 200);
    const row = await store.getByAddress(ALICE);
    assert.equal(row!.optedIn, false);
  });
});

describe("notifications · GET /api/notifications/unsubscribe", () => {
  it("flips optedIn on a valid HMAC token", async () => {
    const { app, store } = buildTestApp();
    await store.upsert({
      address: ALICE,
      email: "alice@example.com",
      optedIn: true,
      signedMessage: "x",
      signature: "0x",
      signedAt: Date.now(),
    });

    // Reuse the helper exposed for the digest worker.
    const { buildUnsubscribeUrl } = await import("./notifications.js");
    const url = buildUnsubscribeUrl({
      appUrl: "https://growfi.test",
      apiBase: "https://api.local",
      unsubSecret: UNSUB_SECRET,
      address: ALICE,
    });
    const token = new URL(url).searchParams.get("token")!;

    const res = await (await app).inject({
      method: "GET",
      url: `/api/notifications/unsubscribe?token=${token}`,
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /unsubscribed/i);

    const row = await store.getByAddress(ALICE);
    assert.equal(row!.optedIn, false);
  });

  it("rejects a tampered token", async () => {
    const { app } = buildTestApp();
    const res = await (await app).inject({
      method: "GET",
      url: `/api/notifications/unsubscribe?token=${ALICE}.deadbeef`,
    });
    assert.equal(res.statusCode, 400);
  });

  it("rejects a token signed with a different secret", async () => {
    const { app } = buildTestApp();
    const { buildUnsubscribeUrl } = await import("./notifications.js");
    const wrongUrl = buildUnsubscribeUrl({
      appUrl: "https://growfi.test",
      unsubSecret: "wrong-secret",
      address: ALICE,
    });
    const token = new URL(wrongUrl).searchParams.get("token")!;
    const res = await (await app).inject({
      method: "GET",
      url: `/api/notifications/unsubscribe?token=${token}`,
    });
    assert.equal(res.statusCode, 400);
  });
});
