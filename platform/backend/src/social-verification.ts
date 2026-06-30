import type { FastifyInstance } from "fastify";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodePacked,
  fallback,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseEventLogs,
  toBytes,
  type Address,
  type Hex,
  type Log,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, sepolia } from "viem/chains";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const CHALLENGE_VERSION = "v1";
const EAS_PROTOCOL = "GrowFi";
const DEFAULT_EAS_SCHEMA =
  "string protocol,address grower,string platform,string handle,string profileUrl,string proofUrl,bytes32 proofHash,uint64 issuedAt,uint64 expiresAt,uint256 nonce";

const EAS_CONTRACTS: Record<
  number,
  { eas: Address; schemaRegistry: Address }
> = {
  [mainnet.id]: {
    eas: getAddress("0xa1207f3bba224e2c9c3c6ebd2c90b7fe3d0f0d17"),
    schemaRegistry: getAddress("0xa7b39296258348c78294f95b872b282326a97bdf"),
  },
  [sepolia.id]: {
    eas: getAddress("0xc2679fbd37d54388ce493f1db75320d236e1815e"),
    schemaRegistry: getAddress("0x0a7e2ff54e76b8e6659aedc9103fb21c038050d0"),
  },
};

const EAS_ABI = [
  {
    type: "event",
    name: "Attested",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "attester", type: "address", indexed: true },
      { name: "uid", type: "bytes32", indexed: false },
      { name: "schema", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "function",
    name: "attest",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "schema", type: "bytes32" },
          {
            name: "data",
            type: "tuple",
            components: [
              { name: "recipient", type: "address" },
              { name: "expirationTime", type: "uint64" },
              { name: "revocable", type: "bool" },
              { name: "refUID", type: "bytes32" },
              { name: "data", type: "bytes" },
              { name: "value", type: "uint256" },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const SCHEMA_REGISTRY_ABI = [
  {
    type: "function",
    name: "getSchema",
    stateMutability: "view",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "uid", type: "bytes32" },
          { name: "resolver", type: "address" },
          { name: "revocable", type: "bool" },
          { name: "schema", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "schema", type: "string" },
      { name: "resolver", type: "address" },
      { name: "revocable", type: "bool" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const PRODUCER_REGISTRY_SOCIAL_ABI = [
  {
    type: "function",
    name: "setSocialAttestation",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "attestation",
        type: "tuple",
        components: [
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
      },
    ],
    outputs: [],
  },
] as const;

export interface SocialVerificationDeps {
  secret?: string | null;
  verifierPrivateKey?: Hex | null;
  registryAddress?: Address | null;
  chainId?: number;
  challengeTtlMs?: number;
  attestationTtlSeconds?: number;
  fetchText?: (url: string) => Promise<Response>;
  onchainAttester?: SocialOnchainAttester | null;
}

export interface SocialOnchainAttester {
  issue(input: {
    attestation: SocialAttestationMessage;
  }): Promise<SocialOnchainResult>;
}

export interface SocialOnchainResult {
  eas: {
    schema: string;
    schemaUID: Hex;
    attestationUID: Hex;
    txHash: Hex;
    address: Address;
    schemaRegistryAddress: Address;
    registrationTxHash?: Hex | null;
  };
  registry?: {
    address: Address;
    txHash: Hex;
  } | null;
}

export interface SocialOnchainAttesterConfig {
  chainId: number;
  rpcUrl?: string;
  rpcUrls?: readonly string[];
  verifierPrivateKey: Hex;
  registryAddress?: Address | null;
  easAddress?: Address | null;
  schemaRegistryAddress?: Address | null;
  schema?: string;
  resolver?: Address;
  revocable?: boolean;
  relayRegistry?: boolean;
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

export type SocialAttestationMessage = {
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

export function buildSocialOnchainAttester(
  config: SocialOnchainAttesterConfig,
): SocialOnchainAttester {
  const account = privateKeyToAccount(config.verifierPrivateKey);
  const rpcUrls = normalizeRpcUrls(config.rpcUrls ?? config.rpcUrl);
  if (rpcUrls.length === 0) {
    throw new Error("At least one social RPC URL is required");
  }
  const transport = rpcUrls.length === 1
    ? http(rpcUrls[0])
    : fallback(rpcUrls.map((url) => http(url)));
  const chain = config.chainId === sepolia.id
    ? sepolia
    : config.chainId === mainnet.id
      ? mainnet
      : undefined;
  const publicClient = createPublicClient({
    chain,
    transport,
  });
  const walletClient = createWalletClient({
    account,
    chain,
    transport,
  });
  const defaults = EAS_CONTRACTS[config.chainId];
  const easAddress = config.easAddress ?? defaults?.eas;
  const schemaRegistryAddress =
    config.schemaRegistryAddress ?? defaults?.schemaRegistry;
  if (!easAddress || !schemaRegistryAddress) {
    throw new Error(`EAS contracts are not configured for chain ${config.chainId}`);
  }

  const schema = config.schema ?? DEFAULT_EAS_SCHEMA;
  const resolver = config.resolver ?? ZERO_ADDRESS;
  const revocable = config.revocable ?? true;
  const relayRegistry = config.relayRegistry ?? true;

  return {
    async issue({ attestation }) {
      const { schemaUID, registrationTxHash } = await ensureSchema({
        publicClient,
        walletClient,
        account,
        schemaRegistryAddress,
        schema,
        resolver,
        revocable,
      });
      const easRequest = {
        schema: schemaUID,
        data: {
          recipient: attestation.producer,
          expirationTime: BigInt(attestation.expiresAt),
          revocable,
          refUID: ZERO_BYTES32,
          data: encodeSocialAttestationData(attestation),
          value: 0n,
        },
      };
      const simulation = await publicClient.simulateContract({
        account,
        address: easAddress,
        abi: EAS_ABI,
        functionName: "attest",
        args: [easRequest],
        value: 0n,
      });
      const easTxHash = await walletClient.writeContract(simulation.request);
      const easReceipt = await publicClient.waitForTransactionReceipt({
        hash: easTxHash,
      });
      const attestationUID = readEasAttestationUID({
        logs: easReceipt.logs,
        recipient: attestation.producer,
        attester: account.address,
        schemaUID,
      });

      const nextAttestation = {
        ...attestation,
        attestationUID,
      };
      let registry: SocialOnchainResult["registry"] = null;
      if (relayRegistry && config.registryAddress) {
        const registryTxHash = await walletClient.writeContract({
          address: config.registryAddress,
          abi: PRODUCER_REGISTRY_SOCIAL_ABI,
          functionName: "setSocialAttestation",
          args: [toRegistryAttestation(nextAttestation)],
        });
        await publicClient.waitForTransactionReceipt({ hash: registryTxHash });
        registry = {
          address: config.registryAddress,
          txHash: registryTxHash,
        };
      }

      return {
        eas: {
          schema,
          schemaUID,
          attestationUID,
          txHash: easTxHash,
          address: easAddress,
          schemaRegistryAddress,
          registrationTxHash,
        },
        registry,
      };
    },
  };
}

function normalizeRpcUrls(input: string | readonly string[] | undefined): string[] {
  const values = Array.isArray(input) ? input : input ? [input] : [];
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

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

    let onchainResult: SocialOnchainResult | null = null;
    if (deps.onchainAttester) {
      try {
        onchainResult = await deps.onchainAttester.issue({ attestation });
        attestation.attestationUID = onchainResult.eas.attestationUID;
      } catch (err) {
        req.log.error({ err }, "social verification onchain attestation failed");
        return reply.status(502).send({
          error: "Unable to publish social attestation on-chain",
        });
      }
    }

    const registryAddress = deps.registryAddress ?? null;
    const chainId = deps.chainId ?? 1;
    const typedData = registryAddress
      ? buildTypedData(chainId, registryAddress, attestation)
      : null;

    let verifier: Address | null = null;
    let signature: Hex | null = null;
    if (deps.verifierPrivateKey) {
      const account = privateKeyToAccount(deps.verifierPrivateKey);
      verifier = account.address;
      if (typedData && !onchainResult?.registry) {
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
    }

    return {
      ok: true,
      authorizationReady: Boolean(signature || onchainResult?.registry),
      verifier,
      signature,
      attestation,
      typedData,
      eas: onchainResult?.eas ?? {
        schema: DEFAULT_EAS_SCHEMA,
        schemaUID: ZERO_BYTES32,
        attestationUID: ZERO_BYTES32,
      },
      registry: onchainResult?.registry ?? null,
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

async function ensureSchema(input: {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
  account: ReturnType<typeof privateKeyToAccount>;
  schemaRegistryAddress: Address;
  schema: string;
  resolver: Address;
  revocable: boolean;
}): Promise<{ schemaUID: Hex; registrationTxHash: Hex | null }> {
  const schemaUID = computeEasSchemaUID(
    input.schema,
    input.resolver,
    input.revocable,
  );
  const record = await input.publicClient.readContract({
    address: input.schemaRegistryAddress,
    abi: SCHEMA_REGISTRY_ABI,
    functionName: "getSchema",
    args: [schemaUID],
  });
  if (schemaRecordUid(record) !== ZERO_BYTES32) {
    return { schemaUID, registrationTxHash: null };
  }

  const txHash = await input.walletClient.writeContract({
    chain: undefined,
    account: input.account,
    address: input.schemaRegistryAddress,
    abi: SCHEMA_REGISTRY_ABI,
    functionName: "register",
    args: [input.schema, input.resolver, input.revocable],
  });
  await input.publicClient.waitForTransactionReceipt({ hash: txHash });
  return { schemaUID, registrationTxHash: txHash };
}

export function computeEasSchemaUID(
  schema: string,
  resolver: Address,
  revocable: boolean,
): Hex {
  return keccak256(
    encodePacked(["string", "address", "bool"], [schema, resolver, revocable]),
  );
}

function schemaRecordUid(record: unknown): Hex {
  if (Array.isArray(record) && typeof record[0] === "string") {
    return record[0] as Hex;
  }
  if (
    record &&
    typeof record === "object" &&
    "uid" in record &&
    typeof record.uid === "string"
  ) {
    return record.uid as Hex;
  }
  return ZERO_BYTES32;
}

function readEasAttestationUID(input: {
  logs: readonly Log[];
  recipient: Address;
  attester: Address;
  schemaUID: Hex;
}): Hex {
  const attestedLogs = parseEventLogs({
    abi: EAS_ABI,
    eventName: "Attested",
    logs: [...input.logs],
  });
  const matching = attestedLogs.find((log) => {
    const args = log.args;
    return (
      args.recipient.toLowerCase() === input.recipient.toLowerCase() &&
      args.attester.toLowerCase() === input.attester.toLowerCase() &&
      args.schema.toLowerCase() === input.schemaUID.toLowerCase()
    );
  });
  const uid = matching?.args.uid ?? attestedLogs[0]?.args.uid ?? ZERO_BYTES32;
  if (uid === ZERO_BYTES32) {
    throw new Error("EAS receipt did not include an Attested event");
  }
  return uid;
}

function encodeSocialAttestationData(attestation: SocialAttestationMessage): Hex {
  return encodeAbiParameters(
    [
      { name: "protocol", type: "string" },
      { name: "grower", type: "address" },
      { name: "platform", type: "string" },
      { name: "handle", type: "string" },
      { name: "profileUrl", type: "string" },
      { name: "proofUrl", type: "string" },
      { name: "proofHash", type: "bytes32" },
      { name: "issuedAt", type: "uint64" },
      { name: "expiresAt", type: "uint64" },
      { name: "nonce", type: "uint256" },
    ],
    [
      EAS_PROTOCOL,
      attestation.producer,
      attestation.platform,
      attestation.handle,
      attestation.profileUrl,
      attestation.proofUrl,
      attestation.proofHash,
      BigInt(attestation.issuedAt),
      BigInt(attestation.expiresAt),
      BigInt(attestation.nonce),
    ],
  );
}

function toRegistryAttestation(attestation: SocialAttestationMessage) {
  return {
    producer: attestation.producer,
    platform: attestation.platform,
    handle: attestation.handle,
    profileUrl: attestation.profileUrl,
    proofUrl: attestation.proofUrl,
    proofHash: attestation.proofHash,
    issuedAt: BigInt(attestation.issuedAt),
    expiresAt: BigInt(attestation.expiresAt),
    nonce: BigInt(attestation.nonce),
    attestationUID: attestation.attestationUID,
  };
}
