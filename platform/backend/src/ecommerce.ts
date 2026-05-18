import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { getAddress, keccak256, toBytes, type Address } from "viem";
import type { EmailSender } from "./email.js";

interface StaticStorageConfig {
  spacesBucket: string;
  spacesPublicBase: string;
  hasCredentials: boolean;
}

type PutObject = (cmd: PutObjectCommand) => Promise<unknown>;

interface EcommerceCatalogBody {
  campaign: string;
  title?: string;
  description?: string;
  currency?: string;
  repaymentAllocationBps?: number;
  items: unknown[];
}

interface EcommerceOrderDraftBody {
  campaign: string;
  buyer: string;
  skuId: string;
  quantity: string | number;
  checkout?: unknown;
  customer?: unknown;
  fulfillment?: unknown;
  metadata?: unknown;
}

interface EcommercePurchaseReceiptBody {
  email?: string;
  campaignName?: string;
  productName?: string;
  quantity?: string | number;
  paymentAmount?: string;
  paymentToken?: string;
  protocolFee?: string;
  repaymentAllocated?: string;
  producerNet?: string;
  orderHash?: string;
  txHash?: string;
  txUrl?: string;
  buyer?: string;
  shippingSummary?: string;
}

const MAX_CATALOG_ITEMS = 100;
const MAX_CATALOG_BYTES = 200_000;
const MAX_ORDER_BYTES = 100_000;
const MAX_UINT256 = (1n << 256n) - 1n;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== "string") return null;
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

function normalizeBytes32(value: unknown): `0x${string}` | null {
  if (typeof value !== "string" || !BYTES32_RE.test(value)) return null;
  return value.toLowerCase() as `0x${string}`;
}

function normalizeQuantity(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return String(value);
  }

  if (typeof value !== "string" || !/^[0-9]+$/.test(value) || value.length > 78) return null;
  const parsed = BigInt(value);
  return parsed > 0n && parsed <= MAX_UINT256 ? parsed.toString() : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function cleanString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJson(value[key])]),
  );
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function validateCatalogItems(items: unknown[]): Array<Record<string, unknown> & { skuId: `0x${string}` }> | null {
  if (items.length === 0 || items.length > MAX_CATALOG_ITEMS) return null;

  const normalized: Array<Record<string, unknown> & { skuId: `0x${string}` }> = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const skuId = normalizeBytes32(item.skuId);
    if (!skuId) return null;
    normalized.push({ ...item, skuId });
  }
  return normalized;
}

export function registerEcommerceRoutes(
  app: FastifyInstance,
  opts: {
    config: StaticStorageConfig;
    putObject: PutObject;
    email?: EmailSender;
    appUrl?: string;
  },
): void {
  const { config, putObject, email, appUrl = "https://growfi.app" } = opts;

  app.post<{ Body: EcommerceCatalogBody }>("/api/ecommerce/catalog", async (req, reply) => {
    if (!config.hasCredentials) {
      return reply.status(503).send({ error: "DO Spaces is not configured" });
    }

    const campaign = normalizeAddress(req.body.campaign);
    const items = Array.isArray(req.body.items) ? validateCatalogItems(req.body.items) : null;
    if (!campaign || !items) {
      return reply.status(400).send({ error: "campaign and items[].skuId are required" });
    }

    const repaymentAllocationBps = req.body.repaymentAllocationBps ?? 0;
    if (
      !Number.isInteger(repaymentAllocationBps) ||
      repaymentAllocationBps < 0 ||
      repaymentAllocationBps > 10_000
    ) {
      return reply.status(400).send({ error: "Invalid repaymentAllocationBps" });
    }

    const catalog = {
      schema: "growfi.ecommerce.catalog.v1",
      campaign,
      title: optionalString(req.body.title),
      description: optionalString(req.body.description),
      currency: optionalString(req.body.currency) ?? "USDC",
      repaymentAllocationBps,
      items,
      createdAt: Date.now(),
    };

    const body = JSON.stringify(catalog, null, 2);
    if (Buffer.byteLength(body, "utf8") > MAX_CATALOG_BYTES) {
      return reply.status(413).send({ error: "Catalog is too large" });
    }

    const key = `ecommerce/catalogs/${campaign.toLowerCase()}/${nanoid(12)}.json`;
    await putObject(
      new PutObjectCommand({
        Bucket: config.spacesBucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
        ACL: "public-read",
        CacheControl: "public, max-age=60",
      }),
    );

    return {
      key,
      url: `${config.spacesPublicBase}/${key}`,
      catalog,
    };
  });

  app.post<{ Body: EcommerceOrderDraftBody }>("/api/ecommerce/order-draft", async (req, reply) => {
    if (!config.hasCredentials) {
      return reply.status(503).send({ error: "DO Spaces is not configured" });
    }

    const campaign = normalizeAddress(req.body.campaign);
    const buyer = normalizeAddress(req.body.buyer);
    const skuId = normalizeBytes32(req.body.skuId);
    const quantity = normalizeQuantity(req.body.quantity);
    if (!campaign || !buyer || !skuId || !quantity) {
      return reply.status(400).send({ error: "campaign, buyer, skuId and quantity are required" });
    }

    const draft = {
      schema: "growfi.ecommerce.order.v1",
      id: nanoid(16),
      campaign,
      buyer,
      skuId,
      quantity,
      checkout: req.body.checkout ?? null,
      customer: req.body.customer ?? null,
      fulfillment: req.body.fulfillment ?? null,
      metadata: req.body.metadata ?? null,
      createdAt: Date.now(),
    };

    const hashPayload = stableStringify(draft);
    if (Buffer.byteLength(hashPayload, "utf8") > MAX_ORDER_BYTES) {
      return reply.status(413).send({ error: "Order draft is too large" });
    }

    const orderHash = keccak256(toBytes(hashPayload));
    const key = `ecommerce/orders/${campaign.toLowerCase()}/${orderHash}.json`;
    await putObject(
      new PutObjectCommand({
        Bucket: config.spacesBucket,
        Key: key,
        Body: JSON.stringify({ ...draft, orderHash }, null, 2),
        ContentType: "application/json",
        ACL: "private",
        CacheControl: "no-store",
      }),
    );

    return {
      orderHash,
      key,
      order: {
        id: draft.id,
        campaign,
        buyer,
        skuId,
        quantity,
        createdAt: draft.createdAt,
      },
    };
  });

  app.post<{ Body: EcommercePurchaseReceiptBody }>("/api/ecommerce/purchase-receipt", async (req, reply) => {
    if (!email) {
      return reply.status(503).send({ error: "Email sender is not configured" });
    }

    const to = cleanString(req.body.email, 180).toLowerCase();
    const buyer = normalizeAddress(req.body.buyer);
    const orderHash = normalizeBytes32(req.body.orderHash);
    const txHash = cleanString(req.body.txHash, 80).toLowerCase();
    const quantity = normalizeQuantity(req.body.quantity);
    if (!EMAIL_RE.test(to) || !buyer || !orderHash || !TX_HASH_RE.test(txHash) || !quantity) {
      return reply.status(400).send({
        error: "email, buyer, orderHash, txHash and quantity are required",
      });
    }

    const paymentToken = cleanString(req.body.paymentToken, 24) || "USDC";
    const receipt = {
      campaignName: cleanString(req.body.campaignName, 160) || "GrowFi campaign",
      productName: cleanString(req.body.productName, 180) || "GrowFi product",
      quantity,
      paymentAmount: cleanString(req.body.paymentAmount, 48) || "0",
      paymentToken,
      protocolFee: cleanString(req.body.protocolFee, 48) || "0",
      repaymentAllocated: cleanString(req.body.repaymentAllocated, 48) || "0",
      producerNet: cleanString(req.body.producerNet, 48) || "0",
      orderHash,
      txHash: txHash as `0x${string}`,
      txUrl: cleanString(req.body.txUrl, 240) || `${appUrl.replace(/\/$/, "")}/tx/${txHash}`,
      buyer,
      shippingSummary: cleanString(req.body.shippingSummary, 240) || undefined,
    };

    try {
      const result = await email.send({
        to,
        kind: "ecommerce_receipt",
        data: { appUrl, receipt },
      });

      if (!result.delivered) {
        app.log.error({ error: result.error, to, orderHash }, "ecommerce receipt email was not delivered");
        return reply.status(202).send({ ok: true, emailDelivered: false });
      }

      return reply.status(201).send({ ok: true, emailDelivered: true });
    } catch (err) {
      app.log.error({ err, to, orderHash }, "ecommerce receipt email failed");
      return reply.status(202).send({ ok: true, emailDelivered: false });
    }
  });
}
