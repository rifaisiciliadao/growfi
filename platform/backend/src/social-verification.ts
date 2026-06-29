import type { FastifyInstance } from "fastify";
import {
  getAddress,
  isAddress,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const CHALLENGE_VERSION = "v1";

export interface SocialVerificationDeps {
  secret?: string | null;
  verifierPrivateKey?: Hex | null;
  registryAddress?: Address | null;
  chainId?: number;
  challengeTtlMs?: number;
  attestationTtlSeconds?: number;
  fetchText?: (url: string) => Promise<Response>;
}

type ChallengePayload = {
  wallet: Address;
  platform: string;
  handle: string;
  profileUrl: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  code: string;
  message: string;
};

type SocialAttestationMessage = {
  producer: Address;
  platform: string;
  handle: string;
  profileUrl: string;
  proofUrl: string;
  proofHash: Hex;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  attestationUID: Hex;
};

const socialAttestationTypes = {
  SocialAttestation: [
    { name: "producer", type: "address" },
    { name: "platform", type: "string" },
    { name: "handle", type: "string" },
    { name: "profileUrl", type: "string" },
    { name: "proofUrl", type: "string" },
    { name: "proofHash", type: "bytes32" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "nonce", type: "uint256" },
    { name: "attestationUID", type: "bytes32" },
  ],
} as const;

export function registerSocialVerificationRoutes(
  app: FastifyInstance,
  deps: SocialVerificationDeps,
) {
  const fetchText = deps.fetchText ?? ((url: string) => fetch(url));
  const challengeTtlMs = deps.challengeTtlMs ?? 15 * 60 * 1000;
  const attestationTtlSeconds = deps.attestationTtlSeconds ?? 180 * 24 * 60 * 60;

  app.post<{
    Body: {
      wallet: string;
      platform: string;
      handle?: string;
      profileUrl?: string;
    };
  }>("/api/social-verification/challenge", async (req, reply) => {
    if (!deps.secret) {
      return reply.status(503).send({ error: "Social verification is not configured" });
    }

    const parsed = parseChallengeRequest(req.body);
    if ("error" in parsed) return reply.status(400).send({ error: parsed.error });

    const now = Date.now();
    const nonce = randomBytes(16).toString("hex");
    const code = `GROWFI-SOCIAL-${parsed.wallet}-${nonce}`;
    const payload: ChallengePayload = {
      ...parsed,
      nonce,
      issuedAt: now,
      expiresAt: now + challengeTtlMs,
      code,
      message: `GrowFi social verification: ${code}`,
    };

    return {
      ...payload,
      challenge: signChallenge(payload, deps.secret),
    };
  });

  app.post<{
    Body: {
      wallet: string;
      platform: string;
      handle?: string;
      profileUrl?: string;
      proofUrl: string;
      nonce: string;
      issuedAt: number;
      expiresAt: number;
      code: string;
      message: string;
      challenge: string;
      onchainNonce: string | number;
    };
  }>("/api/social-verification/verify", async (req, reply) => {
    if (!deps.secret) {
      return reply.status(503).send({ error: "Social verification is not configured" });
    }

    const parsed = parseChallengeRequest(req.body);
    if ("error" in parsed) return reply.status(400).send({ error: parsed.error });

    const proofUrl = normalizeHttpUrl(req.body.proofUrl);
    if (!proofUrl) return reply.status(400).send({ error: "Invalid proofUrl" });

    const challengePayload: ChallengePayload = {
      ...parsed,
      nonce: String(req.body.nonce ?? ""),
      issuedAt: Number(req.body.issuedAt),
      expiresAt: Number(req.body.expiresAt),
      code: String(req.body.code ?? ""),
      message: String(req.body.message ?? ""),
    };
    if (!verifyChallenge(challengePayload, String(req.body.challenge ?? ""), deps.secret)) {
      return reply.status(400).send({ error: "Invalid social verification challenge" });
    }
    if (challengePayload.expiresAt <= Date.now()) {
      return reply.status(400).send({ error: "Social verification challenge expired" });
    }

    const proof = await fetchText(proofUrl);
    if (!proof.ok) {
      return reply.status(400).send({ error: `Proof URL returned HTTP ${proof.status}` });
    }

    const text = await proof.text();
    if (!proofTextContainsChallenge(text, challengePayload)) {
      return reply.status(400).send({
        error: "Proof URL does not contain the GrowFi verification code",
      });
    }

    let onchainNonce: bigint;
    try {
      onchainNonce = BigInt(req.body.onchainNonce);
    } catch {
      return reply.status(400).send({ error: "Invalid onchainNonce" });
    }
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + attestationTtlSeconds;
    const proofHash = hashProof({
      wallet: parsed.wallet,
      platform: parsed.platform,
      handle: parsed.handle,
      profileUrl: parsed.profileUrl,
      proofUrl,
      code: challengePayload.code,
      text,
    });
    const attestation: SocialAttestationMessage = {
      producer: parsed.wallet,
      platform: parsed.platform,
      handle: parsed.handle,
      profileUrl: parsed.profileUrl,
      proofUrl,
      proofHash,
      issuedAt,
      expiresAt,
      nonce: onchainNonce.toString(),
      attestationUID: ZERO_BYTES32,
    };

    const registryAddress = deps.registryAddress ?? null;
    const chainId = deps.chainId ?? 1;
    const typedData = registryAddress
      ? buildTypedData(chainId, registryAddress, attestation)
      : null;

    let verifier: Address | null = null;
    let signature: Hex | null = null;
    if (deps.verifierPrivateKey && typedData) {
      const account = privateKeyToAccount(deps.verifierPrivateKey);
      verifier = account.address;
      signature = await account.signTypedData({
        domain: typedData.domain,
        types: socialAttestationTypes,
        primaryType: "SocialAttestation",
        message: {
          ...attestation,
          issuedAt: BigInt(attestation.issuedAt),
          expiresAt: BigInt(attestation.expiresAt),
          nonce: onchainNonce,
        },
      });
    }

    return {
      ok: true,
      authorizationReady: Boolean(signature),
      verifier,
      signature,
      attestation,
      typedData,
      eas: {
        schema: "growfi.social.v1",
        attestationUID: ZERO_BYTES32,
      },
    };
  });
}

function parseChallengeRequest(body: {
  wallet?: string;
  platform?: string;
  handle?: string;
  profileUrl?: string;
}): Omit<ChallengePayload, "nonce" | "issuedAt" | "expiresAt" | "code" | "message"> | { error: string } {
  if (!body.wallet || !isAddress(body.wallet)) return { error: "Invalid wallet" };
  const platform = normalizePlatform(body.platform);
  if (!platform) return { error: "Invalid platform" };
  let profileUrl = "";
  if (body.profileUrl) {
    const normalized = normalizeHttpUrl(body.profileUrl);
    if (!normalized) return { error: "Invalid profileUrl" };
    profileUrl = normalized;
  }
  return {
    wallet: getAddress(body.wallet),
    platform,
    handle: normalizeHandle(body.handle ?? ""),
    profileUrl,
  };
}

function normalizePlatform(platform: string | undefined): string | null {
  const p = (platform ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{1,32}$/.test(p)) return null;
  return p;
}

function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").slice(0, 80);
}

function normalizeHttpUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function signChallenge(payload: ChallengePayload, secret: string): string {
  const mac = createHmac("sha256", secret)
    .update(JSON.stringify(challengeCanonical(payload)))
    .digest("hex");
  return `${CHALLENGE_VERSION}.${mac}`;
}

function verifyChallenge(payload: ChallengePayload, challenge: string, secret: string): boolean {
  const expected = signChallenge(payload, secret);
  const left = Buffer.from(challenge);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function challengeCanonical(payload: ChallengePayload) {
  return {
    wallet: payload.wallet.toLowerCase(),
    platform: payload.platform,
    handle: payload.handle,
    profileUrl: payload.profileUrl,
    nonce: payload.nonce,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    code: payload.code,
    message: payload.message,
  };
}

function proofTextContainsChallenge(text: string, payload: ChallengePayload): boolean {
  const haystack = text.toLowerCase();
  return (
    haystack.includes(payload.code.toLowerCase()) ||
    (haystack.includes(payload.wallet.toLowerCase()) &&
      haystack.includes(payload.nonce.toLowerCase()))
  );
}

function hashProof(input: {
  wallet: Address;
  platform: string;
  handle: string;
  profileUrl: string;
  proofUrl: string;
  code: string;
  text: string;
}): Hex {
  return keccak256(
    toBytes(
      JSON.stringify({
        wallet: input.wallet.toLowerCase(),
        platform: input.platform,
        handle: input.handle,
        profileUrl: input.profileUrl,
        proofUrl: input.proofUrl,
        code: input.code,
        textHash: keccak256(toBytes(input.text)),
      }),
    ),
  );
}

function buildTypedData(
  chainId: number,
  verifyingContract: Address,
  message: SocialAttestationMessage,
) {
  return {
    domain: {
      name: "GrowfiProducerRegistry",
      version: "1",
      chainId,
      verifyingContract,
    },
    types: socialAttestationTypes,
    primaryType: "SocialAttestation",
    message,
  } as const;
}
