import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";
import { getAddress, type Address } from "viem";
import { buildTree } from "./merkle.js";
import { snapshotSeasonYield } from "./snapshot.js";

const PORT = Number(process.env.PORT || 4001);
const HOST = process.env.HOST || "0.0.0.0";

const SPACES_REGION = process.env.DO_SPACES_REGION || "fra1";
const SPACES_BUCKET = process.env.DO_SPACES_BUCKET || "growfi-media";
const SPACES_ENDPOINT =
  process.env.DO_SPACES_ENDPOINT ||
  `https://${SPACES_REGION}.digitaloceanspaces.com`;
const SPACES_PUBLIC_BASE =
  process.env.DO_SPACES_PUBLIC_BASE ||
  `https://${SPACES_BUCKET}.${SPACES_REGION}.digitaloceanspaces.com`;

const s3 = new S3Client({
  endpoint: SPACES_ENDPOINT,
  region: SPACES_REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY || "",
    secretAccessKey: process.env.DO_SPACES_SECRET || "",
  },
  forcePathStyle: false,
});

const app = Fastify({
  logger: { transport: { target: "pino-pretty" } },
  bodyLimit: 10 * 1024 * 1024,
});

await app.register(cors, { origin: true });
await app.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.get("/health", async () => ({ status: "ok", ts: Date.now() }));

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

app.post("/api/upload", async (req, reply) => {
  if (!process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) {
    return reply.status(503).send({
      error: "DO Spaces non configurato. Imposta DO_SPACES_KEY e DO_SPACES_SECRET.",
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

  await s3.send(
    new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: data.mimetype,
      ACL: "public-read",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    key,
    url: `${SPACES_PUBLIC_BASE}/${key}`,
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
  };
}>("/api/metadata", async (req, reply) => {
  if (!process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) {
    return reply.status(503).send({ error: "DO Spaces non configurato" });
  }

  const { name, description, location, productType, imageUrl } = req.body;
  if (!name || !description) {
    return reply.status(400).send({ error: "name e description obbligatori" });
  }

  const metadata = {
    name,
    description,
    location,
    productType,
    image: imageUrl ?? null,
    createdAt: Date.now(),
  };

  const key = `metadata/${nanoid(12)}.json`;

  await s3.send(
    new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: key,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: "application/json",
      ACL: "public-read",
      CacheControl: "public, max-age=60",
    }),
  );

  return {
    key,
    url: `${SPACES_PUBLIC_BASE}/${key}`,
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
  if (!process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) {
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

  await s3.send(
    new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: key,
      Body: JSON.stringify(profile, null, 2),
      ContentType: "application/json",
      ACL: "public-read",
      CacheControl: "public, max-age=60",
    }),
  );

  return {
    key,
    url: `${SPACES_PUBLIC_BASE}/${key}`,
    profile,
  };
});

/**
 * Snapshot the per-user $YIELD for a season.
 *
 * Given (campaign, seasonId), walks the active positions indexed by
 * the subgraph for that season and combines
 * `Position.yieldClaimed` (from YieldMinted events) with the live
 * `StakingVault.earned(positionId)` read. The response is shaped so
 * it can be fed directly into /api/merkle/generate.
 *
 * Intended usage by the producer:
 *   1. endSeason(seasonId)
 *   2. GET /api/snapshot/:campaign/:seasonId
 *   3. POST /api/merkle/generate with `holders` from step 2
 *   4. reportHarvest(seasonId, totalValueUSD, root, totalUnits)
 */
app.get<{
  Params: { campaign: string; seasonId: string };
}>("/api/snapshot/:campaign/:seasonId", async (req, reply) => {
  const { campaign, seasonId } = req.params;
  try {
    const snap = await snapshotSeasonYield(
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

/**
 * Generate a Merkle tree for a season's product redemption.
 *
 * Body:
 *   campaign: address (proxy)
 *   seasonId: number | string
 *   totalProductUnits: string (18-dec)
 *   holders: Array<{ user: address, yieldAmount: string (18-dec) }>
 *   minProductClaim: string (18-dec) — holders below this are excluded
 *
 * Each holder's allocation is:
 *   productAmount = yieldAmount * totalProductUnits / totalYield
 *
 * Returns:
 *   { root, filename, url, count }
 *
 * The tree JSON is stored at merkle/<campaign>/<seasonId>.json on DO
 * Spaces. The producer passes `root` to HarvestManager.reportHarvest.
 */
app.post<{
  Body: {
    campaign: string;
    seasonId: string | number;
    totalProductUnits: string;
    holders: Array<{ user: string; yieldAmount: string }>;
    minProductClaim?: string;
  };
}>("/api/merkle/generate", async (req, reply) => {
  if (!process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) {
    return reply.status(503).send({ error: "DO Spaces non configurato" });
  }

  const { campaign, seasonId, totalProductUnits, holders, minProductClaim } =
    req.body;
  if (!campaign || seasonId === undefined || !totalProductUnits || !holders) {
    return reply.status(400).send({ error: "campos requeridos" });
  }

  const campaignAddr = getAddress(campaign);
  const seasonIdBig = BigInt(seasonId);
  const totalUnits = BigInt(totalProductUnits);
  const minClaim = BigInt(minProductClaim ?? "0");

  const totalYield = holders.reduce(
    (acc, h) => acc + BigInt(h.yieldAmount),
    0n,
  );
  if (totalYield === 0n) {
    return reply.status(400).send({ error: "totalYield is zero" });
  }

  const leaves = holders
    .map((h) => {
      const productAmount =
        (BigInt(h.yieldAmount) * totalUnits) / totalYield;
      return {
        user: getAddress(h.user) as Address,
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

  // Persist tree + proofs to Spaces, keyed deterministically so the
  // /api/merkle/:campaign/:seasonId/:user endpoint can find them.
  const key = `merkle/${campaignAddr.toLowerCase()}/${seasonIdBig}.json`;
  const payload = {
    campaign: campaignAddr,
    seasonId: seasonIdBig.toString(),
    totalProductUnits: totalUnits.toString(),
    root,
    leaves: leaves.map((l) => ({
      user: l.user,
      productAmount: l.productAmount.toString(),
      proof: proofs[l.user.toLowerCase()],
    })),
    generatedAt: Date.now(),
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: key,
      Body: JSON.stringify(payload, null, 2),
      ContentType: "application/json",
      ACL: "public-read",
      CacheControl: "public, max-age=86400",
    }),
  );

  return {
    root,
    url: `${SPACES_PUBLIC_BASE}/${key}`,
    count: leaves.length,
  };
});

/**
 * Fetch a specific user's (proof, productAmount) for redeeming a
 * season's harvest. Backed by the same JSON the /generate endpoint
 * writes to Spaces — reads it via a direct GET, no signed request
 * needed since the object is public.
 */
app.get<{
  Params: { campaign: string; seasonId: string; user: string };
}>("/api/merkle/:campaign/:seasonId/:user", async (req, reply) => {
  const { campaign, seasonId, user } = req.params;
  const url = `${SPACES_PUBLIC_BASE}/merkle/${campaign.toLowerCase()}/${seasonId}.json`;

  const res = await fetch(url);
  if (!res.ok) {
    return reply.status(404).send({ error: "Merkle tree not found", url });
  }
  const payload = (await res.json()) as {
    leaves: Array<{ user: string; productAmount: string; proof: string[] }>;
  };

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
    productAmount: match.productAmount,
    proof: match.proof,
  };
});

app.setErrorHandler((err, _req, reply) => {
  app.log.error(err);
  reply.status(err.statusCode || 500).send({
    error: err.message || "Errore interno",
  });
});

app
  .listen({ port: PORT, host: HOST })
  .then(() =>
    console.log(`GrowFi backend in ascolto su http://${HOST}:${PORT}`),
  );
