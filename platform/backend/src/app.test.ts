import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { getAddress, verifyTypedData } from "viem";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  buildApp,
  buildDefaultDeps,
  socialRpcUrls,
  type AppDeps,
} from "./app.js";
import type { EmailPayload } from "./email.js";
import type { SnapshotResult } from "./snapshot.js";
import { computeEasSchemaUID } from "./social-verification.js";

const ALICE = getAddress("0xAaaaAaaAAaaAAaAaaAAaaaAaaaaaaAAaaAAaAaAa");
const BOB = getAddress("0xBbbbbbBBbBbbbBBBbbBBbbBbbbbbBBBbbbbBBbBb");
const CAMPAIGN = getAddress("0x1111111111111111111111111111111111111111");
const VAULT = getAddress("0x2222222222222222222222222222222222222222");
const YIELD = getAddress("0x3333333333333333333333333333333333333333");
const TEST_REGISTRY_ADDRESS = getAddress("0x4444444444444444444444444444444444444444");
const SKU = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TEST_VERIFIER_PRIVATE_KEY = `0x${"11".repeat(32)}` as const;
const DEFAULT_SOCIAL_EAS_SCHEMA =
  "string protocol,address grower,string platform,string handle,string profileUrl,string proofUrl,bytes32 proofHash,uint64 issuedAt,uint64 expiresAt,uint256 nonce";

const SOCIAL_ENV_KEYS = [
  "CHAIN_ID",
  "NEXT_PUBLIC_CHAIN_ID",
  "SOCIAL_VERIFIER_PRIVATE_KEY",
  "PRODUCER_REGISTRY_ADDRESS",
  "NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS",
  "SOCIAL_EAS_ENABLED",
  "SOCIAL_RPC_URLS",
  "SOCIAL_RPC_URL",
  "RPC_URL",
  "SEPOLIA_RPC_URL",
  "MAINNET_RPC_URL",
  "ETHEREUM_RPC_URL",
] as const;

interface TestHarness {
  app: FastifyInstance;
  puts: PutObjectCommand[];
  snapshotCalls: Array<{ campaign: string; seasonId: bigint }>;
  fetchCalls: string[];
  fetchStub: Map<string, { status: number; body: unknown }>;
  snapshotStub: SnapshotResult | Error | null;
}

async function makeApp(overrides: Partial<AppDeps> = {}): Promise<TestHarness> {
  const puts: PutObjectCommand[] = [];
  const snapshotCalls: Array<{ campaign: string; seasonId: bigint }> = [];
  const fetchCalls: string[] = [];
  const fetchStub = new Map<string, { status: number; body: unknown }>();
  let snapshotStub: SnapshotResult | Error | null = null;

  const harness: TestHarness = {
    app: null as unknown as FastifyInstance,
    puts,
    snapshotCalls,
    fetchCalls,
    fetchStub,
    snapshotStub,
  };

  const app = await buildApp({
    config: {
      spacesBucket: "test-bucket",
      spacesPublicBase: "https://cdn.example/test-bucket",
      hasCredentials: true,
    },
    putObject: async (cmd) => {
      puts.push(cmd);
    },
    snapshot: async (campaign, seasonId) => {
      snapshotCalls.push({ campaign, seasonId });
      if (harness.snapshotStub instanceof Error) throw harness.snapshotStub;
      if (!harness.snapshotStub) throw new Error("no snapshot stub configured");
      return harness.snapshotStub;
    },
    fetchJson: async (url) => {
      fetchCalls.push(url);
      const hit = fetchStub.get(url);
      if (!hit) {
        return new Response(null, { status: 404 });
      }
      return new Response(JSON.stringify(hit.body), {
        status: hit.status,
        headers: { "content-type": "application/json" },
      });
    },
    fetchText: async (url) => {
      fetchCalls.push(url);
      const hit = fetchStub.get(url);
      if (!hit) {
        return new Response(null, { status: 404 });
      }
      const body =
        typeof hit.body === "string" ? hit.body : JSON.stringify(hit.body);
      return new Response(body, {
        status: hit.status,
        headers: { "content-type": "text/plain" },
      });
    },
    ...overrides,
  });

  harness.app = app;
  return harness;
}

describe("GET /health", () => {
  it("returns ok", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, "ok");
    assert.equal(typeof body.ts, "number");
  });
});

describe("buildDefaultDeps social onchain wiring", () => {
  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    previous.clear();
    for (const key of SOCIAL_ENV_KEYS) {
      previous.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of SOCIAL_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("enables EAS by default on Sepolia when the verifier key is configured", () => {
    process.env.CHAIN_ID = "11155111";
    process.env.SOCIAL_VERIFIER_PRIVATE_KEY = TEST_VERIFIER_PRIVATE_KEY;
    process.env.PRODUCER_REGISTRY_ADDRESS = TEST_REGISTRY_ADDRESS;

    const deps = buildDefaultDeps();

    assert.ok(deps.socialOnchainAttester);
    assert.equal(deps.socialChainId, 11155111);
    assert.equal(deps.socialRegistryAddress, TEST_REGISTRY_ADDRESS);
  });

  it("keeps EAS opt-in on mainnet", () => {
    process.env.CHAIN_ID = "1";
    process.env.SOCIAL_VERIFIER_PRIVATE_KEY = TEST_VERIFIER_PRIVATE_KEY;
    process.env.PRODUCER_REGISTRY_ADDRESS = TEST_REGISTRY_ADDRESS;

    const deps = buildDefaultDeps();

    assert.equal(deps.socialOnchainAttester, null);
  });

  it("allows Sepolia EAS to be explicitly disabled", () => {
    process.env.CHAIN_ID = "11155111";
    process.env.SOCIAL_VERIFIER_PRIVATE_KEY = TEST_VERIFIER_PRIVATE_KEY;
    process.env.PRODUCER_REGISTRY_ADDRESS = TEST_REGISTRY_ADDRESS;
    process.env.SOCIAL_EAS_ENABLED = "false";

    const deps = buildDefaultDeps();

    assert.equal(deps.socialOnchainAttester, null);
  });

  it("uses explicit social RPC fallbacks before Sepolia defaults", () => {
    process.env.SOCIAL_RPC_URLS = "https://one.example, https://two.example";
    process.env.SOCIAL_RPC_URL = "https://two.example";
    process.env.RPC_URL = "https://shared.example";
    process.env.SEPOLIA_RPC_URL = "https://shared.example";

    assert.deepEqual(socialRpcUrls(11155111), [
      "https://one.example",
      "https://two.example",
      "https://shared.example",
      "https://ethereum-sepolia-rpc.publicnode.com",
      "https://rpc.sepolia.org",
      "https://1rpc.io/sepolia",
    ]);
  });
});

describe("EAS social schema", () => {
  it("computes the SchemaRegistry UID locally", () => {
    const uid = computeEasSchemaUID(
      DEFAULT_SOCIAL_EAS_SCHEMA,
      getAddress("0x0000000000000000000000000000000000000000"),
      true,
    );

    assert.equal(
      uid,
      "0x78422879833ca667e9b3ea79d6aaa24328d751493bbd42c92d271d7e94f40caa",
    );
  });
});

describe("POST /api/upload", () => {
  it("503 when credentials missing", async () => {
    const { app } = await makeApp({
      config: {
        spacesBucket: "x",
        spacesPublicBase: "y",
        hasCredentials: false,
      },
    });
    const boundary = "----b";
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      Buffer.from([0x89, 0x50]),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await app.inject({
      method: "POST",
      url: "/api/upload",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    assert.equal(res.statusCode, 503);
  });

  it("400 when no file", async () => {
    const { app } = await makeApp();
    // Multipart request with no files
    const boundary = "----boundary";
    const res = await app.inject({
      method: "POST",
      url: "/api/upload",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: `--${boundary}\r\nContent-Disposition: form-data; name="foo"\r\n\r\nbar\r\n--${boundary}--\r\n`,
    });
    assert.equal(res.statusCode, 400);
  });

  it("400 on unsupported mimetype", async () => {
    const { app } = await makeApp();
    const boundary = "----b";
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="x.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--${boundary}--\r\n`,
      ),
    ]);
    const res = await app.inject({
      method: "POST",
      url: "/api/upload",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /Tipo file non supportato/);
  });

  it("200 on valid png, stores with campaigns/ prefix", async () => {
    const { app, puts } = await makeApp();
    const boundary = "----b";
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="cover.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await app.inject({
      method: "POST",
      url: "/api/upload",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.match(body.key, /^campaigns\/.+\.png$/);
    assert.equal(body.url, `https://cdn.example/test-bucket/${body.key}`);
    assert.equal(body.contentType, "image/png");
    assert.equal(puts.length, 1);
    assert.equal(puts[0].input.Bucket, "test-bucket");
    assert.equal(puts[0].input.ACL, "public-read");
  });
});

describe("POST /api/metadata", () => {
  it("503 without credentials", async () => {
    const { app } = await makeApp({
      config: {
        spacesBucket: "x",
        spacesPublicBase: "y",
        hasCredentials: false,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/metadata",
      payload: { name: "x", description: "y" },
    });
    assert.equal(res.statusCode, 503);
  });

  it("400 when name or description missing", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/metadata",
      payload: { description: "only desc" },
    });
    assert.equal(res.statusCode, 400);
  });

  it("200 stores JSON under metadata/ prefix", async () => {
    const { app, puts } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/metadata",
      payload: {
        name: "Olive IGP",
        description: "Sicilian olive grove",
        location: "Ragusa, Sicily",
        productType: "Extra virgin olive oil",
        imageUrl: "https://cdn.example/x.png",
      },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.match(body.key, /^metadata\/.+\.json$/);
    assert.equal(body.metadata.name, "Olive IGP");
    assert.equal(body.metadata.image, "https://cdn.example/x.png");
    assert.equal(puts.length, 1);
    assert.equal(puts[0].input.ContentType, "application/json");
  });
});

describe("POST /api/producer", () => {
  it("400 when name missing", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/producer",
      payload: { bio: "x" },
    });
    assert.equal(res.statusCode, 400);
  });

  it("200 stores profile under producers/ prefix with defaults", async () => {
    const { app, puts } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/producer",
      payload: { name: "Azienda Pisciotto" },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.match(body.key, /^producers\/.+\.json$/);
    assert.equal(body.profile.name, "Azienda Pisciotto");
    assert.equal(body.profile.bio, "");
    assert.equal(body.profile.avatar, null);
    assert.equal(puts.length, 1);
  });
});

describe("POST /api/ecommerce/catalog", () => {
  it("503 without credentials", async () => {
    const { app } = await makeApp({
      config: {
        spacesBucket: "x",
        spacesPublicBase: "y",
        hasCredentials: false,
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/ecommerce/catalog",
      payload: { campaign: CAMPAIGN, items: [{ skuId: SKU, name: "Oil" }] },
    });
    assert.equal(res.statusCode, 503);
  });

  it("400 when campaign or sku ids are invalid", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ecommerce/catalog",
      payload: { campaign: "bad", items: [{ skuId: "oil", name: "Oil" }] },
    });
    assert.equal(res.statusCode, 400);
  });

  it("200 stores public catalog JSON under ecommerce/catalogs", async () => {
    const { app, puts } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ecommerce/catalog",
      payload: {
        campaign: CAMPAIGN,
        title: "Olive campaign shop",
        description: "Product catalog",
        repaymentAllocationBps: 1500,
        items: [
          {
            skuId: SKU,
            name: "Extra virgin olive oil 500ml",
            image: "https://cdn.example/oil.png",
          },
        ],
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.match(body.key, new RegExp(`^ecommerce/catalogs/${CAMPAIGN.toLowerCase()}/.+\\.json$`));
    assert.equal(body.url, `https://cdn.example/test-bucket/${body.key}`);
    assert.equal(body.catalog.repaymentAllocationBps, 1500);
    assert.equal(body.catalog.items[0].skuId, SKU);
    assert.equal(puts.length, 1);
    assert.equal(puts[0].input.ACL, "public-read");
    assert.equal(puts[0].input.ContentType, "application/json");

    const stored = JSON.parse(puts[0].input.Body as string);
    assert.equal(stored.schema, "growfi.ecommerce.catalog.v1");
    assert.equal(stored.campaign, CAMPAIGN);
  });
});

describe("POST /api/ecommerce/order-draft", () => {
  it("400 when required fields are invalid", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ecommerce/order-draft",
      payload: { campaign: CAMPAIGN, buyer: BOB, skuId: SKU, quantity: "0" },
    });
    assert.equal(res.statusCode, 400);
  });

  it("200 stores private order draft and returns a bytes32 order hash", async () => {
    const { app, puts } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ecommerce/order-draft",
      payload: {
        campaign: CAMPAIGN,
        buyer: ALICE,
        skuId: SKU,
        quantity: "2",
        checkout: { email: "alice@example.com" },
        fulfillment: { method: "shipping", country: "IT" },
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.match(body.orderHash, /^0x[0-9a-f]{64}$/);
    assert.match(
      body.key,
      new RegExp(`^ecommerce/orders/${CAMPAIGN.toLowerCase()}/0x[0-9a-f]{64}\\.json$`),
    );
    assert.equal(body.key.endsWith(`${body.orderHash}.json`), true);
    assert.equal(body.order.buyer, ALICE);
    assert.equal(body.order.quantity, "2");
    assert.equal(puts.length, 1);
    assert.equal(puts[0].input.ACL, "private");
    assert.equal(puts[0].input.CacheControl, "no-store");

    const stored = JSON.parse(puts[0].input.Body as string);
    assert.equal(stored.schema, "growfi.ecommerce.order.v1");
    assert.equal(stored.orderHash, body.orderHash);
    assert.equal(stored.fulfillment.country, "IT");
  });
});

describe("POST /api/ecommerce/purchase-receipt", () => {
  it("400 when receipt identity fields are invalid", async () => {
    const { app } = await makeApp({
      email: {
        async send() {
          throw new Error("should not send");
        },
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/ecommerce/purchase-receipt",
      payload: {
        email: "bad",
        buyer: BOB,
        orderHash: SKU,
        txHash: SKU,
        quantity: "1",
      },
    });
    assert.equal(res.statusCode, 400);
  });

  it("201 sends a receipt email with payment and order details", async () => {
    const sent: EmailPayload[] = [];
    const { app } = await makeApp({
      appUrl: "https://growfi.test",
      email: {
        async send(payload) {
          sent.push(payload);
          return { delivered: true, id: "email_1" };
        },
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/ecommerce/purchase-receipt",
      payload: {
        email: "alice@example.com",
        campaignName: "Ecommerce Olive Demo",
        productName: "2 products",
        quantity: "3",
        lineItems: [
          { productName: "Extra virgin olive oil 500ml", quantity: "2" },
          { productName: "Olive leaf tea", quantity: "1" },
        ],
        paymentAmount: "36.00",
        paymentToken: "USDC",
        protocolFee: "0.00",
        repaymentAllocated: "3.60",
        producerNet: "32.40",
        orderHash: SKU,
        txHash: SKU,
        buyer: ALICE,
        shippingSummary: "Ship to Ragusa",
      },
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.json(), { ok: true, emailDelivered: true });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "alice@example.com");
    assert.equal(sent[0].kind, "ecommerce_receipt");
    assert.equal(sent[0].data.receipt?.campaignName, "Ecommerce Olive Demo");
    assert.equal(sent[0].data.receipt?.quantity, "3");
    assert.equal(sent[0].data.receipt?.lineItems?.length, 2);
    assert.equal(sent[0].data.receipt?.lineItems?.[1]?.productName, "Olive leaf tea");
    assert.equal(sent[0].data.receipt?.repaymentAllocated, "3.60");
    assert.equal(sent[0].data.receipt?.buyer, ALICE);
  });
});

describe("POST /api/merkle/generate", () => {
  it("400 on empty holders (totalYield=0)", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/merkle/generate",
      payload: {
        campaign: CAMPAIGN,
        seasonId: 1,
        totalProductUnits: "1000000000000000000000",
        totalYieldSupply: "0",
        holders: [{ user: ALICE, yieldAmount: "0" }],
      },
    });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /totalYieldSupply/);
  });

  it("400 when minProductClaim excludes everyone", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/merkle/generate",
      payload: {
        campaign: CAMPAIGN,
        seasonId: 1,
        totalProductUnits: (10n * 10n ** 18n).toString(),
        totalYieldSupply: "2",
        holders: [
          { user: ALICE, yieldAmount: "1" },
          { user: BOB, yieldAmount: "1" },
        ],
        minProductClaim: (100n * 10n ** 18n).toString(),
      },
    });
    assert.equal(res.statusCode, 400);
  });

  it("200 returns root + persists tree JSON to merkle/<campaign>/<season>.json", async () => {
    const { app, puts } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/merkle/generate",
      payload: {
        campaign: CAMPAIGN,
        seasonId: 3,
        totalProductUnits: (100n * 10n ** 18n).toString(),
        totalYieldSupply: (10n * 10n ** 18n).toString(),
        holders: [
          { user: ALICE, yieldAmount: (6n * 10n ** 18n).toString() },
          { user: BOB, yieldAmount: (4n * 10n ** 18n).toString() },
        ],
      },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.match(body.root, /^0x[0-9a-f]{64}$/);
    assert.equal(body.count, 2);
    assert.equal(puts.length, 1);
    assert.equal(
      puts[0].input.Key,
      `merkle/${CAMPAIGN.toLowerCase()}/3.json`,
    );
    const stored = JSON.parse(puts[0].input.Body as string);
    assert.equal(stored.root, body.root);
    assert.equal(stored.totalYieldSupply, (10n * 10n ** 18n).toString());
    assert.equal(stored.leaves.length, 2);
    // Alice: 6/10 * 100e18 = 60e18; Bob: 4/10 * 100e18 = 40e18
    const alice = stored.leaves.find(
      (l: { user: string }) => l.user.toLowerCase() === ALICE.toLowerCase(),
    );
    const bob = stored.leaves.find(
      (l: { user: string }) => l.user.toLowerCase() === BOB.toLowerCase(),
    );
    assert.equal(alice.yieldAmount, (6n * 10n ** 18n).toString());
    assert.equal(alice.productAmount, (60n * 10n ** 18n).toString());
    assert.equal(bob.productAmount, (40n * 10n ** 18n).toString());
  });

  it("uses totalYieldSupply as the Solidity denominator, not local holder sum", async () => {
    const { app, puts } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/merkle/generate",
      payload: {
        campaign: CAMPAIGN,
        seasonId: 4,
        totalProductUnits: (100n * 10n ** 18n).toString(),
        totalYieldSupply: (20n * 10n ** 18n).toString(),
        holders: [
          { user: ALICE, yieldAmount: (6n * 10n ** 18n).toString() },
          { user: BOB, yieldAmount: (4n * 10n ** 18n).toString() },
        ],
      },
    });
    assert.equal(res.statusCode, 200);

    const stored = JSON.parse(puts[0].input.Body as string);
    const alice = stored.leaves.find(
      (l: { user: string }) => l.user.toLowerCase() === ALICE.toLowerCase(),
    );
    const bob = stored.leaves.find(
      (l: { user: string }) => l.user.toLowerCase() === BOB.toLowerCase(),
    );

    assert.equal(alice.productAmount, (30n * 10n ** 18n).toString());
    assert.equal(bob.productAmount, (20n * 10n ** 18n).toString());
  });

  it("400 when submitted holder yield exceeds totalYieldSupply", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/merkle/generate",
      payload: {
        campaign: CAMPAIGN,
        seasonId: 4,
        totalProductUnits: (100n * 10n ** 18n).toString(),
        totalYieldSupply: (5n * 10n ** 18n).toString(),
        holders: [
          { user: ALICE, yieldAmount: (6n * 10n ** 18n).toString() },
        ],
      },
    });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /exceeds/);
  });
});

describe("GET /api/merkle/:campaign/:seasonId/:user", () => {
  it("404 when the tree JSON is missing", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/merkle/${CAMPAIGN}/1/${ALICE}`,
    });
    assert.equal(res.statusCode, 404);
  });

  it("404 when user not in the tree", async () => {
    const h = await makeApp();
    const treeUrl = `${h.app}`; // placeholder
    const url = `https://cdn.example/test-bucket/merkle/${CAMPAIGN.toLowerCase()}/1.json`;
    h.fetchStub.set(url, {
      status: 200,
      body: {
        leaves: [
          {
            user: BOB,
            yieldAmount: "1",
            productAmount: "1",
            proof: ["0x00"],
          },
        ],
      },
    });
    const res = await h.app.inject({
      method: "GET",
      url: `/api/merkle/${CAMPAIGN}/1/${ALICE}`,
    });
    assert.equal(res.statusCode, 404);
    void treeUrl;
  });

  it("200 returns { user, productAmount, proof } for eligible user", async () => {
    const h = await makeApp();
    const url = `https://cdn.example/test-bucket/merkle/${CAMPAIGN.toLowerCase()}/2.json`;
    h.fetchStub.set(url, {
      status: 200,
      body: {
        leaves: [
          {
            user: ALICE,
            yieldAmount: "100",
            productAmount: "42",
            proof: ["0xdeadbeef"],
          },
        ],
      },
    });
    const res = await h.app.inject({
      method: "GET",
      url: `/api/merkle/${CAMPAIGN}/2/${ALICE}`,
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.user, ALICE);
    assert.equal(body.yieldAmount, "100");
    assert.equal(body.productAmount, "42");
    assert.deepEqual(body.proof, ["0xdeadbeef"]);
  });
});

describe("GET /api/snapshot/:campaign/:seasonId", () => {
  it("500 when snapshot fn throws", async () => {
    const h = await makeApp();
    h.snapshotStub = new Error("subgraph down");
    const res = await h.app.inject({
      method: "GET",
      url: `/api/snapshot/${CAMPAIGN}/1`,
    });
    assert.equal(res.statusCode, 500);
    assert.match(res.json().error, /subgraph down/);
  });

  it("200 serializes bigint fields to strings", async () => {
    const h = await makeApp();
    h.snapshotStub = {
      campaign: CAMPAIGN,
      seasonId: 7n,
      stakingVault: VAULT,
      yieldToken: YIELD,
      totalYield: 42n * 10n ** 18n,
      seasonTotalYieldOwed: 42n * 10n ** 18n,
      redeemableYieldSupply: 42n * 10n ** 18n,
      holders: [
        { user: ALICE, yieldAmount: 30n * 10n ** 18n },
        { user: BOB, yieldAmount: 12n * 10n ** 18n },
      ],
      notes: ["ok"],
    };
    const res = await h.app.inject({
      method: "GET",
      url: `/api/snapshot/${CAMPAIGN}/7`,
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.campaign, CAMPAIGN);
    assert.equal(body.seasonId, "7");
    assert.equal(body.totalYield, (42n * 10n ** 18n).toString());
    assert.equal(body.redeemableYieldSupply, (42n * 10n ** 18n).toString());
    assert.equal(body.holders.length, 2);
    assert.equal(body.holders[0].yieldAmount, (30n * 10n ** 18n).toString());
    assert.deepEqual(body.notes, ["ok"]);
    assert.deepEqual(h.snapshotCalls, [{ campaign: CAMPAIGN, seasonId: 7n }]);
  });
});

describe("POST /api/social-verification", () => {
  const verifierPrivateKey =
    "0x59c6995e998f97a5a0044966f0945382e6d6f042d134929a5ea15a438b41f26a" as const;
  const registryAddress = getAddress("0x4444444444444444444444444444444444444444");

  it("503 when social verification secret is missing", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/social-verification/challenge",
      payload: { wallet: ALICE, platform: "x" },
    });
    assert.equal(res.statusCode, 503);
  });

  it("verifies a posted proof and returns a verifier signature", async () => {
    const h = await makeApp({
      socialChallengeSecret: "test-secret",
      socialVerifierPrivateKey: verifierPrivateKey,
      socialRegistryAddress: registryAddress,
      socialChainId: 31337,
      socialAttestationTtlSeconds: 3600,
    });

    const challengeRes = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/challenge",
      payload: {
        wallet: ALICE.toLowerCase(),
        platform: "X",
        handle: "@alice",
        profileUrl: "https://x.com/alice",
      },
    });
    assert.equal(challengeRes.statusCode, 200);
    const challenge = challengeRes.json();
    assert.equal(challenge.wallet, ALICE);
    assert.equal(challenge.platform, "x");
    assert.equal(challenge.handle, "alice");
    assert.match(challenge.code, /^GROWFI-SOCIAL-/);

    const proofUrl = "https://x.com/alice/status/1";
    h.fetchStub.set(proofUrl, {
      status: 200,
      body: `GrowFi social verification post ${challenge.code}`,
    });

    const verifyRes = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/verify",
      payload: {
        ...challenge,
        wallet: ALICE,
        proofUrl,
        onchainNonce: "7",
      },
    });
    assert.equal(verifyRes.statusCode, 200);
    const body = verifyRes.json();
    assert.equal(body.ok, true);
    assert.equal(body.authorizationReady, true);
    assert.equal(body.attestation.producer, ALICE);
    assert.equal(body.attestation.platform, "x");
    assert.equal(body.attestation.handle, "alice");
    assert.equal(body.attestation.proofUrl, proofUrl);
    assert.equal(body.attestation.nonce, "7");
    assert.equal(body.typedData.domain.verifyingContract, registryAddress);
    assert.match(body.signature, /^0x[0-9a-f]+$/i);

    const validSignature = await verifyTypedData({
      address: body.verifier,
      domain: body.typedData.domain,
      types: body.typedData.types,
      primaryType: "SocialAttestation",
      message: {
        ...body.attestation,
        nonce: BigInt(body.attestation.nonce),
      },
      signature: body.signature,
    });
    assert.equal(validSignature, true);
  });

  it("normalizes supported platforms and infers known social profile URLs", async () => {
    const h = await makeApp({
      socialChallengeSecret: "test-secret",
      socialVerifierPrivateKey: verifierPrivateKey,
      socialRegistryAddress: registryAddress,
      socialChainId: 31337,
    });

    const xRes = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/challenge",
      payload: { wallet: ALICE, platform: "twitter", handle: "@alice" },
    });
    assert.equal(xRes.statusCode, 200);
    assert.equal(xRes.json().profileUrl, "https://x.com/alice");

    const tiktokRes = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/challenge",
      payload: { wallet: ALICE, platform: "tiktok", handle: "@alice" },
    });
    assert.equal(tiktokRes.statusCode, 200);
    assert.equal(tiktokRes.json().profileUrl, "https://www.tiktok.com/@alice");
  });

  it("400 when the platform is unsupported or a social handle is missing", async () => {
    const h = await makeApp({
      socialChallengeSecret: "test-secret",
      socialVerifierPrivateKey: verifierPrivateKey,
      socialRegistryAddress: registryAddress,
      socialChainId: 31337,
    });

    const unsupported = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/challenge",
      payload: { wallet: ALICE, platform: "facebook", handle: "alice" },
    });
    assert.equal(unsupported.statusCode, 400);
    assert.equal(unsupported.json().error, "Invalid platform");

    const missingHandle = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/challenge",
      payload: { wallet: ALICE, platform: "x" },
    });
    assert.equal(missingHandle.statusCode, 400);
    assert.equal(missingHandle.json().error, "Handle is required for this platform");
  });

  it("400 when the platform is coming soon", async () => {
    const h = await makeApp({
      socialChallengeSecret: "test-secret",
      socialVerifierPrivateKey: verifierPrivateKey,
      socialRegistryAddress: registryAddress,
      socialChainId: 31337,
    });

    for (const platform of ["instagram", "linkedin"]) {
      const res = await h.app.inject({
        method: "POST",
        url: "/api/social-verification/challenge",
        payload: {
          wallet: ALICE,
          platform,
          handle: "alice",
          profileUrl: `https://example.com/${platform}/alice`,
        },
      });
      assert.equal(res.statusCode, 400);
      assert.equal(res.json().error, "Platform coming soon");
    }
  });

  it("returns EAS and registry transactions when the backend relays onchain", async () => {
    const easUid = `0x${"11".repeat(32)}` as const;
    const easTxHash = `0x${"22".repeat(32)}` as const;
    const registryTxHash = `0x${"33".repeat(32)}` as const;
    const schemaUID = `0x${"44".repeat(32)}` as const;
    const easAddress = getAddress("0x5555555555555555555555555555555555555555");
    const schemaRegistryAddress = getAddress("0x6666666666666666666666666666666666666666");
    const relayInputs: unknown[] = [];
    const h = await makeApp({
      socialChallengeSecret: "test-secret",
      socialVerifierPrivateKey: verifierPrivateKey,
      socialRegistryAddress: registryAddress,
      socialChainId: 31337,
      socialAttestationTtlSeconds: 3600,
      socialOnchainAttester: {
        issue: async ({ attestation }) => {
          relayInputs.push({ ...attestation });
          return {
            eas: {
              schema:
                DEFAULT_SOCIAL_EAS_SCHEMA,
              schemaUID,
              attestationUID: easUid,
              txHash: easTxHash,
              address: easAddress,
              schemaRegistryAddress,
              registrationTxHash: null,
            },
            registry: {
              address: registryAddress,
              txHash: registryTxHash,
            },
          };
        },
      },
    });

    const challengeRes = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/challenge",
      payload: {
        wallet: ALICE,
        platform: "x",
        handle: "alice",
        profileUrl: "https://x.com/alice",
      },
    });
    assert.equal(challengeRes.statusCode, 200);
    const challenge = challengeRes.json();
    const proofUrl = "https://x.com/alice/status/2";
    h.fetchStub.set(proofUrl, {
      status: 200,
      body: `GrowFi social verification post ${challenge.code}`,
    });

    const verifyRes = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/verify",
      payload: {
        ...challenge,
        wallet: ALICE,
        proofUrl,
        onchainNonce: "8",
      },
    });
    assert.equal(verifyRes.statusCode, 200);
    const body = verifyRes.json();
    assert.equal(body.ok, true);
    assert.equal(body.authorizationReady, true);
    assert.equal(body.signature, null);
    assert.equal(body.attestation.attestationUID, easUid);
    assert.equal(body.typedData.message.attestationUID, easUid);
    assert.equal(body.eas.attestationUID, easUid);
    assert.equal(body.eas.schemaUID, schemaUID);
    assert.equal(body.eas.txHash, easTxHash);
    assert.equal(body.registry.address, registryAddress);
    assert.equal(body.registry.txHash, registryTxHash);
    assert.equal(relayInputs.length, 1);
    assert.equal(
      (relayInputs[0] as { attestationUID: string }).attestationUID,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("400 when the proof URL does not contain the challenge code", async () => {
    const h = await makeApp({
      socialChallengeSecret: "test-secret",
      socialVerifierPrivateKey: verifierPrivateKey,
      socialRegistryAddress: registryAddress,
      socialChainId: 31337,
    });

    const challengeRes = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/challenge",
      payload: {
        wallet: ALICE,
        platform: "x",
        handle: "alice",
        profileUrl: "https://x.com/alice",
      },
    });
    assert.equal(challengeRes.statusCode, 200);
    const challenge = challengeRes.json();
    const proofUrl = "https://x.com/alice/status/1";
    h.fetchStub.set(proofUrl, {
      status: 200,
      body: "no verification code here",
    });

    const verifyRes = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/verify",
      payload: {
        ...challenge,
        proofUrl,
        onchainNonce: "0",
      },
    });
    assert.equal(verifyRes.statusCode, 400);
    assert.match(verifyRes.json().error, /verification code/);
  });

  it("400 when the proof URL does not match the selected platform", async () => {
    const h = await makeApp({
      socialChallengeSecret: "test-secret",
      socialVerifierPrivateKey: verifierPrivateKey,
      socialRegistryAddress: registryAddress,
      socialChainId: 31337,
    });

    const challengeRes = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/challenge",
      payload: {
        wallet: ALICE,
        platform: "x",
        handle: "alice",
        profileUrl: "https://x.com/alice",
      },
    });
    assert.equal(challengeRes.statusCode, 200);
    const challenge = challengeRes.json();

    const verifyRes = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/verify",
      payload: {
        ...challenge,
        proofUrl: "https://postman-echo.com/get?growfi=not-x",
        onchainNonce: "0",
      },
    });
    assert.equal(verifyRes.statusCode, 400);
    assert.equal(verifyRes.json().error, "Proof URL must be an X post URL");
    assert.equal(h.fetchCalls.length, 0);
  });

  it("400 when a website proof URL is outside the profile domain", async () => {
    const h = await makeApp({
      socialChallengeSecret: "test-secret",
      socialVerifierPrivateKey: verifierPrivateKey,
      socialRegistryAddress: registryAddress,
      socialChainId: 31337,
    });

    const challengeRes = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/challenge",
      payload: {
        wallet: ALICE,
        platform: "website",
        profileUrl: "https://growfi.dev",
      },
    });
    assert.equal(challengeRes.statusCode, 200);
    const challenge = challengeRes.json();

    const verifyRes = await h.app.inject({
      method: "POST",
      url: "/api/social-verification/verify",
      payload: {
        ...challenge,
        proofUrl: "https://example.com/growfi-proof",
        onchainNonce: "0",
      },
    });
    assert.equal(verifyRes.statusCode, 400);
    assert.equal(
      verifyRes.json().error,
      "Proof URL must use the same website domain as the profile URL",
    );
    assert.equal(h.fetchCalls.length, 0);
  });
});

beforeEach(() => {
  // Fastify's logger is disabled when NODE_ENV=test, so nothing to reset.
});
