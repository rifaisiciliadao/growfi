import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  getAddress,
  isAddress,
  keccak256,
  recoverMessageAddress,
  toBytes,
  type Hex,
} from "viem";
import { nanoid } from "nanoid";
import type { AppConfig } from "./app.js";
import type {
  ProjectUpdateReactionRecord,
  ProjectUpdateReactionStore,
} from "./project-updates-store.js";

export const PROJECT_UPDATE_ALLOWED_EMOJIS = [
  "👍",
  "👏",
  "🌱",
  "💚",
  "🔥",
  "👀",
] as const;

const DEFAULT_SIG_MAX_AGE_MS = 10 * 60 * 1000;
const MAX_TITLE_CHARS = 140;
const MAX_BODY_CHARS = 20_000;

export interface ProjectUpdateRoutesDeps {
  config: AppConfig;
  putObject: (cmd: PutObjectCommand) => Promise<unknown>;
  reactionStore: ProjectUpdateReactionStore;
  signatureMaxAgeMs?: number;
}

interface SignedReactionPayload {
  campaign: string;
  updateId: string;
  address: string;
  emoji: string;
  issuedAt: string;
  nonce: string;
  signature: Hex;
}

export function buildProjectUpdateReactionMessage(p: {
  campaign: string;
  updateId: string;
  address: string;
  emoji: string;
  issuedAt: string;
  nonce: string;
}): string {
  return [
    "GrowFi project update reaction",
    `Campaign: ${p.campaign.toLowerCase()}`,
    `Update ID: ${p.updateId}`,
    `Address: ${p.address.toLowerCase()}`,
    `Emoji: ${p.emoji || "remove"}`,
    `Issued: ${p.issuedAt}`,
    `Nonce: ${p.nonce}`,
  ].join("\n");
}

function parseCampaign(raw: string, reply: FastifyReply): string | null {
  const value = String(raw ?? "").trim();
  if (!isAddress(value)) {
    reply.status(400).send({ error: "Invalid campaign address" });
    return null;
  }
  return getAddress(value).toLowerCase();
}

function parseUpdateId(raw: string, reply: FastifyReply): string | null {
  const value = String(raw ?? "").trim();
  if (!/^[1-9]\d*$/.test(value)) {
    reply.status(400).send({ error: "Invalid update id" });
    return null;
  }
  return value;
}

function summarize(record: ProjectUpdateReactionRecord, viewer?: string | null) {
  const counts: Record<string, number> = {};
  let viewerEmoji: string | null = null;
  const lowerViewer = viewer?.toLowerCase() ?? null;

  for (const row of record.reactions) {
    counts[row.emoji] = (counts[row.emoji] ?? 0) + 1;
    if (lowerViewer && row.address === lowerViewer) viewerEmoji = row.emoji;
  }

  return {
    campaign: record.campaign,
    updateId: record.updateId,
    counts,
    total: record.reactions.length,
    viewerEmoji,
    updatedAt: record.updatedAt,
  };
}

function validateEmoji(raw: string): string | null {
  const emoji = raw.trim();
  return (PROJECT_UPDATE_ALLOWED_EMOJIS as readonly string[]).includes(emoji)
    ? emoji
    : null;
}

export function registerProjectUpdateRoutes(
  app: FastifyInstance,
  deps: ProjectUpdateRoutesDeps,
): void {
  const { config, putObject, reactionStore } = deps;
  const sigMaxAge = deps.signatureMaxAgeMs ?? DEFAULT_SIG_MAX_AGE_MS;

  app.post<{
    Body: {
      campaign?: string;
      title?: string;
      body?: string;
      imageUrl?: string | null;
    };
  }>("/api/project-updates/metadata", async (req, reply) => {
    if (!config.hasCredentials) {
      return reply.status(503).send({ error: "DO Spaces not configured" });
    }

    const campaign = parseCampaign(req.body?.campaign ?? "", reply);
    if (!campaign) return;

    const title = String(req.body?.title ?? "").trim();
    const body = String(req.body?.body ?? "").trim();
    const imageUrl = String(req.body?.imageUrl ?? "").trim() || null;

    if (!title || !body) {
      return reply.status(400).send({ error: "title and body are required" });
    }
    if (title.length > MAX_TITLE_CHARS) {
      return reply.status(400).send({ error: "title is too long" });
    }
    if (body.length > MAX_BODY_CHARS) {
      return reply.status(413).send({ error: "body is too large" });
    }

    const metadata = {
      schema: "growfi.project-update.v1",
      campaign,
      title,
      body,
      image: imageUrl,
      createdAt: Date.now(),
    };
    const bodyText = JSON.stringify(metadata, null, 2);
    const contentHash = keccak256(toBytes(bodyText));
    const key = `project-updates/${campaign}/${nanoid(12)}.json`;

    await putObject(
      new PutObjectCommand({
        Bucket: config.spacesBucket,
        Key: key,
        Body: bodyText,
        ContentType: "application/json",
        ACL: "public-read",
        CacheControl: "public, max-age=60",
      }),
    );

    return {
      key,
      url: `${config.spacesPublicBase}/${key}`,
      contentHash,
      metadata,
    };
  });

  app.get<{
    Params: { campaign: string; updateId: string };
    Querystring: { address?: string };
  }>("/api/project-updates/:campaign/:updateId/reactions", async (req, reply) => {
    const campaign = parseCampaign(req.params.campaign, reply);
    const updateId = parseUpdateId(req.params.updateId, reply);
    if (!campaign || !updateId) return;

    let viewer: string | null = null;
    if (req.query.address) {
      if (!isAddress(req.query.address)) {
        return reply.status(400).send({ error: "Invalid viewer address" });
      }
      viewer = getAddress(req.query.address).toLowerCase();
    }
    const record = await reactionStore.get(campaign, updateId);
    return summarize(record, viewer);
  });

  app.put<{
    Params: { campaign: string; updateId: string };
    Body: Partial<SignedReactionPayload>;
  }>("/api/project-updates/:campaign/:updateId/reactions/me", async (req, reply) => {
    const campaign = parseCampaign(req.params.campaign, reply);
    const updateId = parseUpdateId(req.params.updateId, reply);
    if (!campaign || !updateId) return;

    const body = req.body ?? {};
    if (String(body.campaign ?? "").toLowerCase() !== campaign) {
      return reply.status(400).send({ error: "Campaign mismatch" });
    }
    if (String(body.updateId ?? "") !== updateId) {
      return reply.status(400).send({ error: "Update id mismatch" });
    }
    const addressRaw = String(body.address ?? "").trim();
    if (!isAddress(addressRaw)) {
      return reply.status(400).send({ error: "Invalid address" });
    }
    const address = getAddress(addressRaw).toLowerCase();
    const emoji = String(body.emoji ?? "").trim();
    let normalizedEmoji = "";
    if (emoji) {
      const supportedEmoji = validateEmoji(emoji);
      if (!supportedEmoji) {
        return reply.status(400).send({ error: "Unsupported emoji reaction" });
      }
      normalizedEmoji = supportedEmoji;
    }

    const issuedAt = String(body.issuedAt ?? "").trim();
    const nonce = String(body.nonce ?? "").trim();
    const signature = String(body.signature ?? "").trim() as Hex;
    if (!issuedAt || !nonce || !signature.startsWith("0x")) {
      return reply.status(400).send({ error: "Incomplete signed payload" });
    }
    const issuedMs = Date.parse(issuedAt);
    if (!Number.isFinite(issuedMs)) {
      return reply.status(400).send({ error: "Invalid issuedAt" });
    }
    const ageMs = Date.now() - issuedMs;
    if (ageMs > sigMaxAge || ageMs < -sigMaxAge) {
      return reply.status(400).send({ error: "Signature expired or not yet valid" });
    }

    const message = buildProjectUpdateReactionMessage({
      campaign,
      updateId,
      address,
      emoji: normalizedEmoji,
      issuedAt,
      nonce,
    });

    let recovered: string;
    try {
      recovered = (await recoverMessageAddress({ message, signature })).toLowerCase();
    } catch {
      return reply.status(400).send({ error: "Signature is not verifiable" });
    }
    if (recovered !== address) {
      return reply.status(401).send({ error: "Signature does not match address" });
    }

    const record = normalizedEmoji
      ? await reactionStore.set({ campaign, updateId, address, emoji: normalizedEmoji })
      : await reactionStore.remove({ campaign, updateId, address });

    return {
      ok: true,
      ...summarize(record, address),
    };
  });
}
