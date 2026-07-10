import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { DeleteObjectCommand, S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";
import { getAddress, verifyMessage, type Address, type Hex } from "viem";
import { buildTree } from "./merkle.js";
import {
  readCampaignProducer,
  snapshotSeasonYield,
  type SnapshotResult,
} from "./snapshot.js";
import {
  buildMerklePublicationMessage,
  type MerklePublicationInput,
} from "./merkle-authorization.js";
import type { ResolveHostname } from "./public-http.js";
import { buildSpacesStore, type InviteStore } from "./store.js";
import {
  buildNoopSender,
  buildResendSender,
  type EmailSender,
} from "./email.js";
import { registerInviteRoutes } from "./invite.js";
import { registerInvestorRoutes } from "./investors.js";
import {
  buildSpacesNotificationStore,
  type NotificationStore,
} from "./notifications-store.js";
import { registerNotificationRoutes } from "./notifications.js";
import { registerEcommerceRoutes } from "./ecommerce.js";
import {
  buildSpacesProjectUpdateReactionStore,
  type ProjectUpdateReactionStore,
} from "./project-updates-store.js";
import { registerProjectUpdateRoutes } from "./project-updates.js";
import {
  buildSocialOnchainAttester,
  registerSocialVerificationRoutes,
  type SocialOnchainAttester,
} from "./social-verification.js";

const SEPOLIA_CHAIN_ID = 11155111;

export interface AppConfig {
  spacesBucket: string;
  spacesPublicBase: string;
  hasCredentials: boolean;
}

export interface AppDeps {
  config: AppConfig;
  putObject: (cmd: PutObjectCommand) => Promise<unknown>;
  deleteObject?: (cmd: DeleteObjectCommand) => Promise<unknown>;
  fetchJson?: (url: string) => Promise<Response>;
  snapshot?: (campaign: Address, seasonId: bigint) => Promise<SnapshotResult>;
  inviteStore?: InviteStore;
  notificationStore?: NotificationStore;
  projectUpdateReactionStore?: ProjectUpdateReactionStore;
  email?: EmailSender;
  adminKey?: string | null;
  adminNotifyEmail?: string | null;
  investorNotifyEmail?: string | null;
  appUrl?: string;
  rateLimit?: { windowMs: number; max: number };
  notificationsUnsubSecret?: string;
  /** Override the signed-message max age (default 10 min). */
  signatureMaxAgeMs?: number;
  fetchText?: (url: string) => Promise<Response>;
  socialChallengeSecret?: string | null;
  socialVerifierPrivateKey?: `0x${string}` | null;
  socialRegistryAddress?: Address | null;
  socialChainId?: number;
  socialChallengeTtlMs?: number;
  socialAttestationTtlSeconds?: number;
  socialOnchainAttester?: SocialOnchainAttester | null;
  socialChallengeConsumer?: (reservationId: Hex) => Promise<boolean>;
  socialChallengeReleaser?: (reservationId: Hex) => Promise<void>;
  socialChallengesObjectPrefix?: string;
  resolveHostname?: ResolveHostname;
  campaignProducer?: (campaign: Address) => Promise<Address>;
}

interface CampaignDmrvMetadata {
  provider: "silvi";
  projectId: string;
  url: string;
  embedUrl: string;
  geojsonUrl: string;
  linkedAt: number;
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

export function buildDefaultDeps(): AppDeps {
  const region = process.env.DO_SPACES_REGION || "fra1";
  const bucket = process.env.DO_SPACES_BUCKET || "growfi-media";
  const endpoint =
    process.env.DO_SPACES_ENDPOINT || `https://${region}.digitaloceanspaces.com`;
  const publicBase =
    process.env.DO_SPACES_PUBLIC_BASE ||
    `https://${bucket}.${region}.digitaloceanspaces.com`;

  const s3 = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: process.env.DO_SPACES_KEY || "",
      secretAccessKey: process.env.DO_SPACES_SECRET || "",
    },
    forcePathStyle: false,
  });

  const inviteStore = buildSpacesStore({
    s3,
    bucket,
    prefix: process.env.INVITES_OBJECT_PREFIX || "invites",
  });

  const notificationStore = buildSpacesNotificationStore({
    s3,
    bucket,
    prefix: process.env.NOTIFICATIONS_OBJECT_PREFIX || "notifications",
  });

  const projectUpdateReactionStore = buildSpacesProjectUpdateReactionStore({
    s3,
    bucket,
    prefix:
      process.env.PROJECT_UPDATE_REACTIONS_OBJECT_PREFIX ||
      "project-update-reactions",
  });

  const resendKey = process.env.RESEND_API_KEY;
  const fromAddr = process.env.RESEND_FROM || "GrowFi <hello@growfi.app>";
  const appUrl = process.env.APP_URL || "https://growfi.app";
  const email: EmailSender = resendKey
    ? buildResendSender({ apiKey: resendKey, from: fromAddr, appUrl })
    : buildNoopSender((p) =>
        console.log(`[email noop] to=${p.to} kind=${p.kind} data=${JSON.stringify(p.data)}`),
      );
  const socialChainId = Number(process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || 1);
  const socialVerifierPrivateKey =
    (process.env.SOCIAL_VERIFIER_PRIVATE_KEY as `0x${string}` | undefined) ||
    null;
  const socialRegistryAddress =
    addressFromEnv(process.env.PRODUCER_REGISTRY_ADDRESS) ||
    addressFromEnv(process.env.NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS);
  const socialOnchainAttester = buildDefaultSocialOnchainAttester({
    chainId: socialChainId,
    verifierPrivateKey: socialVerifierPrivateKey,
    registryAddress: socialRegistryAddress,
  });

  return {
    config: {
      spacesBucket: bucket,
      spacesPublicBase: publicBase,
      hasCredentials:
        Boolean(process.env.DO_SPACES_KEY) &&
        Boolean(process.env.DO_SPACES_SECRET),
    },
    putObject: (cmd) => s3.send(cmd),
    deleteObject: (cmd) => s3.send(cmd),
    snapshot: snapshotSeasonYield,
    inviteStore,
    notificationStore,
    projectUpdateReactionStore,
    email,
    adminKey: process.env.ADMIN_API_KEY || null,
    adminNotifyEmail: process.env.ADMIN_NOTIFY_EMAIL || "hey@growfi.dev",
    investorNotifyEmail:
      process.env.INVESTOR_NOTIFY_EMAIL ||
      process.env.ADMIN_NOTIFY_EMAIL ||
      "hey@growfi.dev",
    appUrl,
    rateLimit: {
      windowMs: Number(process.env.INVITE_RATE_WINDOW_MS || 60 * 60 * 1000),
      max: Number(process.env.INVITE_RATE_MAX || 5),
    },
    notificationsUnsubSecret:
      process.env.NOTIFICATIONS_UNSUB_SECRET ||
      // Dev-only fallback so local boots work without env. Logs a warning at
      // build time. NEVER rely on this in prod — set the env explicitly.
      "growfi-dev-unsub-secret-do-not-use-in-prod",
    socialChallengeSecret: process.env.SOCIAL_CHALLENGE_SECRET || null,
    socialVerifierPrivateKey,
    socialRegistryAddress,
    socialChainId,
    socialOnchainAttester,
    socialChallengesObjectPrefix:
      process.env.SOCIAL_CHALLENGES_OBJECT_PREFIX || "social-challenges",
    campaignProducer: readCampaignProducer,
  };
}

function buildDefaultSocialOnchainAttester(input: {
  chainId: number;
  verifierPrivateKey: `0x${string}` | null;
  registryAddress: Address | null;
}): SocialOnchainAttester | null {
  const easEnabled = socialEasEnabled(input.chainId, input.verifierPrivateKey);
  if (!easEnabled) return null;
  if (!input.verifierPrivateKey) {
    return failedSocialOnchainAttester(
      "SOCIAL_EAS_ENABLED=true but SOCIAL_VERIFIER_PRIVATE_KEY is missing",
    );
  }
  const rpcUrls = socialRpcUrls(input.chainId);
  if (rpcUrls.length === 0) {
    return failedSocialOnchainAttester(
      "SOCIAL_EAS_ENABLED=true but no social RPC URL is configured",
    );
  }
  return buildSocialOnchainAttester({
    chainId: input.chainId,
    rpcUrls,
    verifierPrivateKey: input.verifierPrivateKey,
    registryAddress: input.registryAddress,
    easAddress: addressFromEnv(process.env.SOCIAL_EAS_ADDRESS),
    schemaRegistryAddress: addressFromEnv(process.env.SOCIAL_EAS_SCHEMA_REGISTRY_ADDRESS),
    schema: process.env.SOCIAL_EAS_SCHEMA || undefined,
    resolver: addressFromEnv(process.env.SOCIAL_EAS_RESOLVER) || undefined,
    revocable: booleanFromEnv(process.env.SOCIAL_EAS_REVOCABLE, true),
    relayRegistry: booleanFromEnv(process.env.SOCIAL_REGISTRY_RELAY, true),
    maxGasPriceWei: positiveBigIntFromEnv(process.env.SOCIAL_EAS_MAX_GAS_PRICE_WEI),
  });
}

function failedSocialOnchainAttester(message: string): SocialOnchainAttester {
  console.warn(`[social] ${message}`);
  return {
    async issue() {
      throw new Error(message);
    },
  };
}

export function socialRpcUrls(chainId: number): string[] {
  const urls = [
    process.env.SOCIAL_RPC_URLS,
    process.env.SOCIAL_RPC_URL,
    process.env.RPC_URL,
    ...(chainId === SEPOLIA_CHAIN_ID
      ? [
          process.env.SEPOLIA_RPC_URL,
          "https://ethereum-sepolia-rpc.publicnode.com",
          "https://rpc.sepolia.org",
          "https://1rpc.io/sepolia",
        ]
      : []),
    ...(chainId === 1
      ? [process.env.MAINNET_RPC_URL, process.env.ETHEREUM_RPC_URL]
      : []),
  ];
  const seen = new Set<string>();
  return urls
    .flatMap((url) => (url ?? "").split(","))
    .map((url) => url.trim())
    .filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function socialEasEnabled(
  chainId: number,
  verifierPrivateKey: `0x${string}` | null,
): boolean {
  const configured = process.env.SOCIAL_EAS_ENABLED;
  if (configured !== undefined && configured !== "") {
    return booleanFromEnv(configured, false);
  }
  return chainId === SEPOLIA_CHAIN_ID && Boolean(verifierPrivateKey);
}

function addressFromEnv(value: string | undefined): Address | null {
  if (!value) return null;
  try {
    return getAddress(value);
  } catch {
    console.warn(`[env] ignoring invalid address: ${value}`);
    return null;
  }
}

function positiveBigIntFromEnv(value: string | undefined): bigint | undefined {
  if (!value) return undefined;
  try {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : undefined;
  } catch {
    console.warn("[env] ignoring invalid positive bigint value");
    return undefined;
  }
}

function booleanFromEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return /^(1|true|yes|on)$/i.test(value);
}

function parseCampaignDmrv(raw: unknown): CampaignDmrvMetadata | null | Error {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "object") return new Error("Invalid dMRV metadata");
  const value = raw as Partial<CampaignDmrvMetadata>;
  if (value.provider !== "silvi") {
    return new Error("Unsupported dMRV provider");
  }
  const projectId = String(value.projectId ?? "").trim();
  if (!/^[1-9]\d*$/.test(projectId)) {
    return new Error("Invalid dMRV project id");
  }
  const url = parsePublicUrl(value.url, "Invalid dMRV URL");
  if (url instanceof Error) return url;
  const embedUrl = parsePublicUrl(value.embedUrl, "Invalid dMRV embed URL");
  if (embedUrl instanceof Error) return embedUrl;
  const geojsonUrl = parsePublicUrl(value.geojsonUrl, "Invalid dMRV GeoJSON URL");
  if (geojsonUrl instanceof Error) return geojsonUrl;
  const linkedAt =
    typeof value.linkedAt === "number" && Number.isFinite(value.linkedAt)
      ? value.linkedAt
      : Date.now();
  return {
    provider: "silvi",
    projectId,
    url,
    embedUrl,
    geojsonUrl,
    linkedAt,
  };
}

function parsePublicUrl(value: unknown, message: string): string | Error {
  const raw = String(value ?? "").trim();
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return new Error(message);
    }
    return url.toString();
  } catch {
    return new Error(message);
  }
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config, putObject } = deps;
  const snapshot = deps.snapshot ?? snapshotSeasonYield;
  const fetchJson = deps.fetchJson ?? ((url: string) => fetch(url));
  const fetchText = deps.fetchText ?? ((url: string) => fetch(url));
  const consumeSocialChallenge = deps.socialChallengeConsumer ?? (async (reservationId: Hex) => {
    const prefix = deps.socialChallengesObjectPrefix ?? "social-challenges";
    try {
      await putObject(new PutObjectCommand({
        Bucket: config.spacesBucket,
        Key: `${prefix}/${reservationId.slice(2)}.json`,
        Body: JSON.stringify({ reservationId, consumedAt: Date.now() }),
        ContentType: "application/json",
        ACL: "private",
        CacheControl: "no-store",
        IfNoneMatch: "*",
      }));
      return true;
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 412 || (err as { name?: string }).name === "PreconditionFailed") {
        return false;
      }
      throw err;
    }
  });
  const releaseSocialChallenge = deps.socialChallengeReleaser ?? (async (reservationId: Hex) => {
    if (!deps.deleteObject) return;
    const prefix = deps.socialChallengesObjectPrefix ?? "social-challenges";
    await deps.deleteObject(new DeleteObjectCommand({
      Bucket: config.spacesBucket,
      Key: `${prefix}/${reservationId.slice(2)}.json`,
    }));
  });

  const app = Fastify({
    logger: process.env.NODE_ENV === "test"
      ? false
      : { transport: { target: "pino-pretty" } },
    bodyLimit: 10 * 1024 * 1024,
  });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  app.get("/health", async () => ({ status: "ok", ts: Date.now() }));

  if (deps.inviteStore && deps.email) {
    registerInviteRoutes(app, {
      store: deps.inviteStore,
      email: deps.email,
      adminKey: deps.adminKey ?? null,
      adminNotifyEmail: deps.adminNotifyEmail ?? null,
      appUrl: deps.appUrl ?? "https://growfi.app",
      rateLimit: deps.rateLimit ?? { windowMs: 60 * 60 * 1000, max: 5 },
    });
  }

  if (deps.email) {
    registerInvestorRoutes(app, {
      email: deps.email,
      notifyEmail:
        deps.investorNotifyEmail === undefined
          ? (deps.adminNotifyEmail ?? null)
          : deps.investorNotifyEmail,
      appUrl: deps.appUrl ?? "https://growfi.app",
      rateLimit: deps.rateLimit ?? { windowMs: 60 * 60 * 1000, max: 5 },
    });
  }

  if (deps.notificationStore && deps.notificationsUnsubSecret) {
    registerNotificationRoutes(app, {
      store: deps.notificationStore,
      unsubSecret: deps.notificationsUnsubSecret,
      appUrl: deps.appUrl ?? "https://growfi.app",
      signatureMaxAgeMs: deps.signatureMaxAgeMs,
    });
  }

  registerEcommerceRoutes(app, {
    config,
    putObject,
    email: deps.email,
    appUrl: deps.appUrl ?? "https://growfi.app",
  });

  if (deps.projectUpdateReactionStore) {
    registerProjectUpdateRoutes(app, {
      config,
      putObject,
      reactionStore: deps.projectUpdateReactionStore,
      signatureMaxAgeMs: deps.signatureMaxAgeMs,
    });
  }

  registerSocialVerificationRoutes(app, {
    secret: deps.socialChallengeSecret,
    verifierPrivateKey: deps.socialVerifierPrivateKey,
    registryAddress: deps.socialRegistryAddress,
    chainId: deps.socialChainId,
    challengeTtlMs: deps.socialChallengeTtlMs,
    attestationTtlSeconds: deps.socialAttestationTtlSeconds,
    fetchText,
    resolveHostname: deps.resolveHostname,
    onchainAttester: deps.socialOnchainAttester,
    campaignProducer: deps.campaignProducer,
    consumeChallenge: consumeSocialChallenge,
    releaseChallenge: releaseSocialChallenge,
  });

  app.post("/api/upload", async (req, reply) => {
    if (!config.hasCredentials) {
      return reply.status(503).send({
        error:
          "DO Spaces non configurato. Imposta DO_SPACES_KEY e DO_SPACES_SECRET.",
      });
    }

    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: "Nessun file caricato" });
    }

    const ext = ALLOWED_IMAGE_TYPES[data.mimetype];
    if (!ext) {
      return reply.status(400).send({
        error: `Tipo file non supportato: ${data.mimetype}`,
      });
    }

    const buffer = await data.toBuffer();
    const key = `campaigns/${nanoid(12)}.${ext}`;

    await putObject(
      new PutObjectCommand({
        Bucket: config.spacesBucket,
        Key: key,
        Body: buffer,
        ContentType: data.mimetype,
        ACL: "public-read",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    return {
      key,
      url: `${config.spacesPublicBase}/${key}`,
      size: buffer.length,
      contentType: data.mimetype,
      filename: data.filename,
    };
  });

  app.post<{
    Body: {
      name: string;
      description: string;
      location: string;
      productType: string;
      imageUrl?: string;
      dmrv?: CampaignDmrvMetadata | null;
    };
  }>("/api/metadata", async (req, reply) => {
    if (!config.hasCredentials) {
      return reply.status(503).send({ error: "DO Spaces non configurato" });
    }

    const { name, description, location, productType, imageUrl } = req.body;
    if (!name || !description) {
      return reply.status(400).send({ error: "name e description obbligatori" });
    }
    const dmrv = parseCampaignDmrv(req.body.dmrv);
    if (dmrv instanceof Error) {
      return reply.status(400).send({ error: dmrv.message });
    }

    const metadata = {
      name,
      description,
      location,
      productType,
      image: imageUrl ?? null,
      ...(dmrv ? { dmrv } : {}),
      createdAt: Date.now(),
    };

    const key = `metadata/${nanoid(12)}.json`;

    await putObject(
      new PutObjectCommand({
        Bucket: config.spacesBucket,
        Key: key,
        Body: JSON.stringify(metadata, null, 2),
        ContentType: "application/json",
        ACL: "public-read",
        CacheControl: "public, max-age=60",
      }),
    );

    return {
      key,
      url: `${config.spacesPublicBase}/${key}`,
      metadata,
    };
  });

  app.post<{
    Body: {
      name: string;
      bio: string;
      avatar?: string | null;
      cover?: string | null;
      website?: string | null;
      location?: string | null;
    };
  }>("/api/producer", async (req, reply) => {
    if (!config.hasCredentials) {
      return reply.status(503).send({ error: "DO Spaces non configurato" });
    }

    const { name, bio, avatar, cover, website, location } = req.body;
    if (!name) {
      return reply.status(400).send({ error: "name obbligatorio" });
    }

    const profile = {
      name,
      bio: bio ?? "",
      avatar: avatar ?? null,
      cover: cover ?? null,
      website: website ?? null,
      location: location ?? null,
      updatedAt: Date.now(),
    };

    const key = `producers/${nanoid(12)}.json`;

    await putObject(
      new PutObjectCommand({
        Bucket: config.spacesBucket,
        Key: key,
        Body: JSON.stringify(profile, null, 2),
        ContentType: "application/json",
        ACL: "public-read",
        CacheControl: "public, max-age=60",
      }),
    );

    return {
      key,
      url: `${config.spacesPublicBase}/${key}`,
      profile,
    };
  });

  app.get<{
    Params: { campaign: string; seasonId: string };
  }>("/api/snapshot/:campaign/:seasonId", async (req, reply) => {
    const { campaign, seasonId } = req.params;
    try {
      const snap = await snapshot(
        getAddress(campaign),
        BigInt(seasonId),
      );
      return {
        campaign: snap.campaign,
        seasonId: snap.seasonId.toString(),
        stakingVault: snap.stakingVault,
        yieldToken: snap.yieldToken,
        totalYield: snap.totalYield.toString(),
        seasonTotalYieldOwed: snap.seasonTotalYieldOwed?.toString() ?? null,
        redeemableYieldSupply: snap.redeemableYieldSupply?.toString() ?? null,
        holders: snap.holders.map((h) => ({
          user: h.user,
          yieldAmount: h.yieldAmount.toString(),
        })),
        notes: snap.notes,
      };
    } catch (err) {
      return reply.status(500).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post<{
    Body: {
      campaign: string;
      seasonId: string | number;
      totalProductUnits: string;
      totalYieldSupply: string;
      holders: Array<{ user: string; yieldAmount: string }>;
      minProductClaim?: string;
      authorization?: {
        expiresAt: number;
        signature: Hex;
      };
    };
  }>("/api/merkle/generate", async (req, reply) => {
    if (!config.hasCredentials) {
      return reply.status(503).send({ error: "DO Spaces non configurato" });
    }

    const {
      campaign,
      seasonId,
      totalProductUnits,
      totalYieldSupply,
      holders,
      minProductClaim,
      authorization,
    } = req.body;
    if (!campaign || seasonId === undefined || !totalProductUnits || !totalYieldSupply || !holders) {
      return reply.status(400).send({ error: "campos requeridos" });
    }

    const campaignAddr = getAddress(campaign);
    const seasonIdBig = BigInt(seasonId);
    const totalUnits = BigInt(totalProductUnits);
    const denominator = BigInt(totalYieldSupply);
    const minClaim = BigInt(minProductClaim ?? "0");

    if (!authorization || !Number.isSafeInteger(authorization.expiresAt)) {
      return reply.status(401).send({ error: "Merkle publication signature is required" });
    }
    const now = Date.now();
    if (authorization.expiresAt <= now || authorization.expiresAt > now + 10 * 60 * 1000) {
      return reply.status(401).send({ error: "Merkle publication signature expired or too far in the future" });
    }
    if (!deps.campaignProducer) {
      return reply.status(503).send({ error: "Campaign producer verification is unavailable" });
    }

    let producer: Address;
    try {
      producer = await deps.campaignProducer(campaignAddr);
    } catch {
      return reply.status(502).send({ error: "Unable to resolve campaign producer" });
    }
    const publicationInput: MerklePublicationInput = {
      campaign: campaignAddr,
      seasonId: seasonIdBig,
      totalProductUnits: totalUnits.toString(),
      totalYieldSupply: denominator.toString(),
      holders,
      minProductClaim: minClaim.toString(),
    };
    const publicationMessage = buildMerklePublicationMessage(
      publicationInput,
      authorization.expiresAt,
    );
    const authorized = await verifyMessage({
      address: producer,
      message: publicationMessage,
      signature: authorization.signature,
    }).catch(() => false);
    if (!authorized) {
      return reply.status(403).send({ error: "Invalid campaign producer signature" });
    }

    if (denominator === 0n) {
      return reply.status(400).send({ error: "totalYieldSupply is zero" });
    }

    const submittedYield = holders.reduce(
      (acc, h) => acc + BigInt(h.yieldAmount),
      0n,
    );
    if (submittedYield === 0n) {
      return reply.status(400).send({ error: "totalYield is zero" });
    }
    if (submittedYield > denominator) {
      return reply.status(400).send({
        error: "holders yield exceeds totalYieldSupply",
      });
    }

    const leaves = holders
      .map((h) => {
        const yieldAmount = BigInt(h.yieldAmount);
        const productAmount = (yieldAmount * totalUnits) / denominator;
        return {
          user: getAddress(h.user) as Address,
          yieldAmount,
          productAmount,
        };
      })
      .filter((l) => l.productAmount >= minClaim);

    if (leaves.length === 0) {
      return reply
        .status(400)
        .send({ error: "no holders above minProductClaim" });
    }

    const { root, proofs } = buildTree(seasonIdBig, leaves);

    const key =
      `merkle/${campaignAddr.toLowerCase()}/${seasonIdBig}/${root.toLowerCase()}.json`;
    const payload = {
      campaign: campaignAddr,
      seasonId: seasonIdBig.toString(),
      totalProductUnits: totalUnits.toString(),
      totalYieldSupply: denominator.toString(),
      submittedYield: submittedYield.toString(),
      root,
      leaves: leaves.map((l) => ({
        user: l.user,
        yieldAmount: l.yieldAmount.toString(),
        productAmount: l.productAmount.toString(),
        proof: proofs[l.user.toLowerCase()],
      })),
      generatedAt: Date.now(),
    };

    try {
      await putObject(
        new PutObjectCommand({
          Bucket: config.spacesBucket,
          Key: key,
          Body: JSON.stringify(payload, null, 2),
          ContentType: "application/json",
          ACL: "public-read",
          CacheControl: "public, max-age=31536000, immutable",
          IfNoneMatch: "*",
        }),
      );
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      const name = (err as { name?: string }).name;
      if (status === 412 || name === "PreconditionFailed") {
        return reply.status(409).send({ error: "Merkle proof set already published" });
      }
      throw err;
    }

    return {
      root,
      url: `${config.spacesPublicBase}/${key}`,
      count: leaves.length,
    };
  });

  app.get<{
    Params: { campaign: string; seasonId: string; root: string; user: string };
  }>("/api/merkle/:campaign/:seasonId/:root/:user", async (req, reply) => {
    const { campaign, seasonId, root, user } = req.params;
    if (!/^0x[0-9a-fA-F]{64}$/.test(root)) {
      return reply.status(400).send({ error: "Invalid Merkle root" });
    }
    const base = `${config.spacesPublicBase}/merkle/${campaign.toLowerCase()}/${seasonId}`;
    let url = `${base}/${root.toLowerCase()}.json`;
    let res = await fetchJson(url);
    if (!res.ok) {
      const legacyUrl = `${base}.json`;
      const legacy = await fetchJson(legacyUrl);
      if (legacy.ok) {
        url = legacyUrl;
        res = legacy;
      }
    }
    if (!res.ok) {
      return reply.status(404).send({ error: "Merkle tree not found", url });
    }
    const payload = (await res.json()) as {
      root?: string;
      leaves: Array<{ user: string; yieldAmount?: string; productAmount: string; proof: string[] }>;
    };
    if (!payload.root || payload.root.toLowerCase() !== root.toLowerCase()) {
      return reply.status(409).send({ error: "Published Merkle root does not match on-chain root" });
    }

    const match = payload.leaves.find(
      (l) => l.user.toLowerCase() === user.toLowerCase(),
    );
    if (!match) {
      return reply.status(404).send({
        error: "User not eligible for product redemption this season",
      });
    }

    return {
      user: getAddress(match.user),
      yieldAmount: match.yieldAmount ?? null,
      productAmount: match.productAmount,
      proof: match.proof,
    };
  });

  app.setErrorHandler((err: unknown, _req, reply) => {
    app.log.error(err);
    const maybeStatus = (err as { statusCode?: number })?.statusCode;
    const maybeMsg =
      (err as { message?: string })?.message ??
      (typeof err === "string" ? err : null);
    reply.status(maybeStatus ?? 500).send({
      error: maybeMsg ?? "Errore interno",
    });
  });

  return app;
}
