import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { mainnet } from "viem/chains";

type ImplementationRecord = {
  address: Address;
  codeHash: Hex;
};

type ProxyRecord = {
  proxy: Address;
  implementation: Address;
  proxyAdmin: Address;
  implementationCodeHash: Hex;
};

type ModuleRecord = ImplementationRecord & {
  name: string;
  moduleType: Hex;
  kind: Hex;
  approved: boolean;
  default: boolean;
};

type CampaignRecord = {
  index: number;
  producer: Address;
  components: Record<string, ProxyRecord>;
  modules: Array<{
    name: string;
    moduleType: Hex;
    kind: Hex;
    implementation: Address;
    enabled: boolean;
  }>;
};

type ProducerRegistryV2Record = ImplementationRecord & {
  deployBlock: number;
  legacyRegistry: Address;
  socialVerifier: Address;
  migratedProducers: Address[];
};

type SocialEasRecord = {
  schemaUid: Hex;
  schema: string;
  revocable: boolean;
  registrationBlock: number;
  registrationTx: Hex;
};

type Manifest = {
  chainId: number;
  verifiedAtBlock: number;
  owner: Address;
  factoryDeployBlock: number;
  factory: ProxyRecord & {
    futureImplementations: Record<string, ImplementationRecord>;
  };
  growSystem: Record<string, ProxyRecord>;
  registries: {
    campaignRegistry: ImplementationRecord;
    legacyProducerRegistry: ImplementationRecord;
    producerRegistryV2: ProducerRegistryV2Record;
  };
  socialEas: SocialEasRecord;
  modules: ModuleRecord[];
  campaigns: CampaignRecord[];
  external: Record<string, { address: Address }>;
};

const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;
const ADMIN_SLOT =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103" as const;

const factoryAbi = parseAbi([
  "function owner() view returns (address)",
  "function proxyAdminOwner() view returns (address)",
  "function campaignImpl() view returns (address)",
  "function campaignTokenImpl() view returns (address)",
  "function stakingVaultImpl() view returns (address)",
  "function yieldTokenImpl() view returns (address)",
  "function harvestManagerImpl() view returns (address)",
  "function growfiToken() view returns (address)",
  "function growfiMinter() view returns (address)",
  "function growfiTreasury() view returns (address)",
  "function growfiFeeSplitter() view returns (address)",
  "function getCampaignCount() view returns (uint256)",
  "function campaigns(uint256) view returns (address campaign, address campaignToken, address yieldToken, address stakingVault, address harvestManager, address producer, uint256 createdAt)",
  "function defaultModulesLength() view returns (uint256)",
  "function defaultModuleAt(uint256) view returns ((bytes32 moduleType, bytes32 kind, address impl, string metadataURI))",
  "function approvedModuleImpls(bytes32,address) view returns (bool)",
  "function campaignPaymentTokenPolicy(address) view returns (bool allowed, bool fixedPricingAllowed, bool oraclePricingAllowed, address oracleFeed)",
]);

const campaignAbi = parseAbi([
  "function moduleTypeCount() view returns (uint256)",
  "function moduleTypeAt(uint256) view returns (bytes32)",
  "function moduleSlot(bytes32) view returns (address impl, bytes32 kind, string metadataURI, uint64 attachedAt, bool enabled)",
]);

const proxyAdminAbi = parseAbi(["function owner() view returns (address)"]);
const treasuryAbi = parseAbi([
  "function stakingPool() view returns (address)",
  "function acceptedStablecoinsLength() view returns (uint256)",
  "function acceptedStablecoinAt(uint256) view returns (address)",
  "function stablecoinConfigs(address) view returns (uint256 scale, address priceFeed, uint256 heartbeat, uint16 minPriceBps, uint16 maxPriceBps)",
]);
const easAbi = parseAbi(["function getSchemaRegistry() view returns (address)"]);
const easSchemaRegistryAbi = parseAbi([
  "function getSchema(bytes32) view returns ((bytes32 uid,address resolver,bool revocable,string schema))",
]);
const producerRegistryV2Abi = parseAbi([
  "function owner() view returns (address)",
  "function legacyRegistry() view returns (address)",
  "function isSocialVerifier(address) view returns (bool)",
  "function legacyProducerMigrated(address) view returns (bool)",
]);

const repoRoot = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const manifest = JSON.parse(
  readFileSync(resolve(repoRoot, "deployments/mainnet.json"), "utf8"),
) as Manifest;
const rpcUrl =
  process.env.MAINNET_RPC_URL ||
  process.env.SOCIAL_RPC_URL ||
  "https://ethereum-rpc.publicnode.com";
const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sameAddress(actual: Address, expected: Address, label: string) {
  assert(
    getAddress(actual) === getAddress(expected),
    `${label}: expected ${expected}, received ${actual}`,
  );
}

function slotAddress(value: Hex | undefined, label: string): Address {
  assert(value && value.length === 66, `${label}: empty storage slot`);
  return getAddress(`0x${value.slice(-40)}`);
}

async function assertImplementation(
  record: ImplementationRecord,
  label: string,
) {
  const code = await client.getBytecode({ address: record.address });
  assert(code && code !== "0x", `${label}: no deployed code at ${record.address}`);
  assert(
    keccak256(code) === record.codeHash,
    `${label}: runtime code hash changed at ${record.address}`,
  );
}

async function assertProxy(record: ProxyRecord, label: string) {
  const [implementationSlot, adminSlot, adminCode, adminOwner] =
    await Promise.all([
      client.getStorageAt({ address: record.proxy, slot: IMPLEMENTATION_SLOT }),
      client.getStorageAt({ address: record.proxy, slot: ADMIN_SLOT }),
      client.getBytecode({ address: record.proxyAdmin }),
      client.readContract({
        address: record.proxyAdmin,
        abi: proxyAdminAbi,
        functionName: "owner",
      }),
    ]);

  sameAddress(
    slotAddress(implementationSlot, `${label} implementation slot`),
    record.implementation,
    `${label} implementation`,
  );
  sameAddress(
    slotAddress(adminSlot, `${label} admin slot`),
    record.proxyAdmin,
    `${label} ProxyAdmin`,
  );
  sameAddress(adminOwner, manifest.owner, `${label} ProxyAdmin owner`);
  assert(adminCode && adminCode !== "0x", `${label}: ProxyAdmin has no code`);
  await assertImplementation(
    {
      address: record.implementation,
      codeHash: record.implementationCodeHash,
    },
    `${label} implementation`,
  );
}

async function readFactoryAddress(functionName: string): Promise<Address> {
  return (await client.readContract({
    address: manifest.factory.proxy,
    abi: factoryAbi,
    functionName: functionName as never,
  })) as Address;
}

async function verifyFactory() {
  const [owner, proxyAdminOwner] = await Promise.all([
    client.readContract({
      address: manifest.factory.proxy,
      abi: factoryAbi,
      functionName: "owner",
    }),
    client.readContract({
      address: manifest.factory.proxy,
      abi: factoryAbi,
      functionName: "proxyAdminOwner",
    }),
  ]);
  sameAddress(owner, manifest.owner, "Factory owner");
  sameAddress(proxyAdminOwner, manifest.owner, "Factory proxyAdminOwner");
  await assertProxy(manifest.factory, "Factory");

  const getters: Record<string, string> = {
    campaign: "campaignImpl",
    campaignToken: "campaignTokenImpl",
    stakingVault: "stakingVaultImpl",
    yieldToken: "yieldTokenImpl",
    harvestManager: "harvestManagerImpl",
  };
  for (const [name, record] of Object.entries(
    manifest.factory.futureImplementations,
  )) {
    const getter = getters[name];
    assert(getter, `No Factory getter configured for ${name}`);
    sameAddress(
      await readFactoryAddress(getter),
      record.address,
      `Factory ${name} implementation pointer`,
    );
    await assertImplementation(record, `Factory ${name} implementation`);
  }
}

async function verifyGrowSystem() {
  const getters: Record<string, string> = {
    token: "growfiToken",
    minter: "growfiMinter",
    treasury: "growfiTreasury",
    feeSplitter: "growfiFeeSplitter",
  };
  for (const [name, record] of Object.entries(manifest.growSystem)) {
    if (name === "stakingPool") {
      const stakingPool = await client.readContract({
        address: manifest.growSystem.treasury.proxy,
        abi: treasuryAbi,
        functionName: "stakingPool",
      });
      sameAddress(stakingPool, record.proxy, "Treasury stakingPool");
    } else {
      sameAddress(
        await readFactoryAddress(getters[name]),
        record.proxy,
        `Factory ${name} proxy`,
      );
    }
    await assertProxy(record, `GROW ${name}`);
  }
}

async function verifyModules() {
  for (const module of manifest.modules) {
    await assertImplementation(module, `Module ${module.name}`);
    const approved = await client.readContract({
      address: manifest.factory.proxy,
      abi: factoryAbi,
      functionName: "approvedModuleImpls",
      args: [module.kind, module.address],
    });
    assert(
      approved === module.approved,
      `Module ${module.name}: approval changed to ${approved}`,
    );
  }

  const defaultCount = await client.readContract({
    address: manifest.factory.proxy,
    abi: factoryAbi,
    functionName: "defaultModulesLength",
  });
  const expectedDefaults = manifest.modules.filter((module) => module.default);
  assert(
    defaultCount === BigInt(expectedDefaults.length),
    `Default module count changed to ${defaultCount}`,
  );
  for (let i = 0; i < expectedDefaults.length; i += 1) {
    const current = await client.readContract({
      address: manifest.factory.proxy,
      abi: factoryAbi,
      functionName: "defaultModuleAt",
      args: [BigInt(i)],
    });
    const expected = expectedDefaults[i];
    assert(
      current.moduleType === expected.moduleType,
      `Default module ${i}: type changed`,
    );
    assert(current.kind === expected.kind, `Default module ${i}: kind changed`);
    sameAddress(current.impl, expected.address, `Default module ${i}`);
  }
}

async function verifyCampaigns() {
  const campaignCount = await client.readContract({
    address: manifest.factory.proxy,
    abi: factoryAbi,
    functionName: "getCampaignCount",
  });
  assert(
    campaignCount === BigInt(manifest.campaigns.length),
    `Campaign count changed to ${campaignCount}`,
  );

  const componentOrder = [
    "campaign",
    "campaignToken",
    "yieldToken",
    "stakingVault",
    "harvestManager",
  ];
  for (const campaign of manifest.campaigns) {
    const live = await client.readContract({
      address: manifest.factory.proxy,
      abi: factoryAbi,
      functionName: "campaigns",
      args: [BigInt(campaign.index)],
    });
    for (let i = 0; i < componentOrder.length; i += 1) {
      const name = componentOrder[i];
      const record = campaign.components[name];
      sameAddress(live[i], record.proxy, `Campaign ${campaign.index} ${name}`);
      await assertProxy(record, `Campaign ${campaign.index} ${name}`);
    }
    sameAddress(live[5], campaign.producer, `Campaign ${campaign.index} producer`);

    const campaignProxy = campaign.components.campaign.proxy;
    const moduleCount = await client.readContract({
      address: campaignProxy,
      abi: campaignAbi,
      functionName: "moduleTypeCount",
    });
    assert(
      moduleCount === BigInt(campaign.modules.length),
      `Campaign ${campaign.index}: module count changed to ${moduleCount}`,
    );
    for (let i = 0; i < campaign.modules.length; i += 1) {
      const expected = campaign.modules[i];
      const moduleType = await client.readContract({
        address: campaignProxy,
        abi: campaignAbi,
        functionName: "moduleTypeAt",
        args: [BigInt(i)],
      });
      assert(
        moduleType === expected.moduleType,
        `Campaign ${campaign.index} module ${i}: type changed`,
      );
      const slot = await client.readContract({
        address: campaignProxy,
        abi: campaignAbi,
        functionName: "moduleSlot",
        args: [moduleType],
      });
      sameAddress(
        slot[0],
        expected.implementation,
        `Campaign ${campaign.index} module ${expected.name}`,
      );
      assert(slot[1] === expected.kind, `Campaign ${campaign.index} ${expected.name}: kind changed`);
      assert(slot[4] === expected.enabled, `Campaign ${campaign.index} ${expected.name}: enabled changed`);
    }
  }
}

async function verifyExternal() {
  for (const [name, record] of Object.entries(manifest.external)) {
    const code = await client.getBytecode({ address: record.address });
    assert(code && code !== "0x", `External ${name}: no code at ${record.address}`);
  }

  const easSchemaRegistry = await client.readContract({
    address: manifest.external.eas.address,
    abi: easAbi,
    functionName: "getSchemaRegistry",
  });
  sameAddress(
    easSchemaRegistry,
    manifest.external.easSchemaRegistry.address,
    "EAS SchemaRegistry",
  );

  for (const [name, expectedAllowed] of [
    ["usdc", true],
    ["usdt", false],
    ["dai", false],
  ] as const) {
    const policy = await client.readContract({
      address: manifest.factory.proxy,
      abi: factoryAbi,
      functionName: "campaignPaymentTokenPolicy",
      args: [manifest.external[name].address],
    });
    assert(
      policy[0] === expectedAllowed,
      `Factory ${name} policy: allowed changed to ${policy[0]}`,
    );
    if (name === "usdc") {
      assert(policy[1], "Factory USDC fixed pricing is disabled");
      assert(!policy[2], "Factory USDC oracle pricing unexpectedly enabled");
    } else {
      assert(!policy[1] && !policy[2], `Factory ${name} pricing unexpectedly enabled`);
    }
  }

  const treasury = manifest.growSystem.treasury.proxy;
  const stablecoinCount = await client.readContract({
    address: treasury,
    abi: treasuryAbi,
    functionName: "acceptedStablecoinsLength",
  });
  assert(stablecoinCount === 1n, `Treasury accepted stablecoin count is ${stablecoinCount}`);
  const acceptedStablecoin = await client.readContract({
    address: treasury,
    abi: treasuryAbi,
    functionName: "acceptedStablecoinAt",
    args: [0n],
  });
  sameAddress(acceptedStablecoin, manifest.external.usdc.address, "Treasury USDC");
  const stablecoinConfig = await client.readContract({
    address: treasury,
    abi: treasuryAbi,
    functionName: "stablecoinConfigs",
    args: [manifest.external.usdc.address],
  });
  assert(stablecoinConfig[0] === 10n ** 12n, "Treasury USDC scale changed");
  sameAddress(
    stablecoinConfig[1],
    manifest.external.usdcUsdFeed.address,
    "Treasury USDC/USD feed",
  );
  assert(stablecoinConfig[2] === 86_400n, "Treasury USDC heartbeat changed");
  assert(stablecoinConfig[3] === 9_500, "Treasury USDC minimum price changed");
  assert(stablecoinConfig[4] === 10_500, "Treasury USDC maximum price changed");
}

async function verifyProducerRegistryV2() {
  const registry = manifest.registries.producerRegistryV2;
  const [owner, legacyRegistry, verifierGranted, schemaRecord] =
    await Promise.all([
      client.readContract({
        address: registry.address,
        abi: producerRegistryV2Abi,
        functionName: "owner",
      }),
      client.readContract({
        address: registry.address,
        abi: producerRegistryV2Abi,
        functionName: "legacyRegistry",
      }),
      client.readContract({
        address: registry.address,
        abi: producerRegistryV2Abi,
        functionName: "isSocialVerifier",
        args: [registry.socialVerifier],
      }),
      client.readContract({
        address: manifest.external.easSchemaRegistry.address,
        abi: easSchemaRegistryAbi,
        functionName: "getSchema",
        args: [manifest.socialEas.schemaUid],
      }),
    ]);

  sameAddress(owner, manifest.owner, "ProducerRegistry V2 owner");
  sameAddress(
    legacyRegistry,
    registry.legacyRegistry,
    "ProducerRegistry V2 legacy registry",
  );
  assert(verifierGranted, "ProducerRegistry V2 social verifier role is missing");

  for (const producer of registry.migratedProducers) {
    const migrated = await client.readContract({
      address: registry.address,
      abi: producerRegistryV2Abi,
      functionName: "legacyProducerMigrated",
      args: [producer],
    });
    assert(migrated, `ProducerRegistry V2: ${producer} was not migrated`);
  }

  assert(
    schemaRecord.uid === manifest.socialEas.schemaUid,
    "GrowFi EAS schema UID changed",
  );
  sameAddress(schemaRecord.resolver, zeroAddress, "GrowFi EAS schema resolver");
  assert(
    schemaRecord.revocable === manifest.socialEas.revocable,
    "GrowFi EAS schema revocability changed",
  );
  assert(
    schemaRecord.schema === manifest.socialEas.schema,
    "GrowFi EAS schema definition changed",
  );
}

function collectAddresses(value: unknown, addresses = new Set<string>()) {
  if (typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)) {
    addresses.add(value.toLowerCase());
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectAddresses(entry, addresses));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => collectAddresses(entry, addresses));
  }
  return addresses;
}

function addressesIn(text: string) {
  return new Set(
    [...text.matchAll(/(?<![0-9a-fA-F])0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g)].map((match) =>
      match[0].toLowerCase(),
    ),
  );
}

function assertYamlEnv(text: string, key: string, expected: Address) {
  const match = text.match(
    new RegExp(`key:\\s*${key}[\\s\\S]{0,160}?value:\\s*["']?(0x[0-9a-fA-F]{40})`, "m"),
  );
  assert(match, `.do/app.yaml: missing ${key}`);
  sameAddress(match[1] as Address, expected, `.do/app.yaml ${key}`);
}

function assertEnv(text: string, key: string, expected: Address) {
  const match = text.match(
    new RegExp(`^${key}=(0x[0-9a-fA-F]{40})$`, "m"),
  );
  assert(match, `Missing ${key}`);
  sameAddress(match[1] as Address, expected, key);
}

function assertContains(text: string, expected: Address, label: string) {
  assert(
    text.toLowerCase().includes(expected.toLowerCase()),
    `${label}: missing ${expected}`,
  );
}

function verifyDocumentation() {
  const known = collectAddresses(manifest);
  const contracts = readFileSync(resolve(repoRoot, "CONTRACTS.md"), "utf8");
  const mainnetSection = contracts.split("\n---\n", 1)[0];
  const documented = addressesIn(mainnetSection);
  for (const address of documented) {
    assert(known.has(address), `CONTRACTS.md: unknown mainnet address ${address}`);
  }
  for (const address of known) {
    assert(documented.has(address), `CONTRACTS.md: undocumented mainnet address ${address}`);
  }

  const rollout = readFileSync(
    resolve(repoRoot, "MAINNET_SECURITY_ROLLOUT_2026-07-10.md"),
    "utf8",
  );
  for (const address of addressesIn(rollout)) {
    assert(known.has(address), `Mainnet rollout: unknown address ${address}`);
  }

  const appSpec = readFileSync(resolve(repoRoot, ".do/app.yaml"), "utf8");
  const currentModules = Object.fromEntries(
    manifest.modules
      .filter((module) => module.approved && !module.name.includes("legacy"))
      .map((module) => [module.name, module.address]),
  ) as Record<string, Address>;
  const appAddresses: Record<string, Address> = {
    NEXT_PUBLIC_FACTORY_ADDRESS: manifest.factory.proxy,
    NEXT_PUBLIC_USDC_ADDRESS: manifest.external.usdc.address,
    NEXT_PUBLIC_USDT_ADDRESS: manifest.external.usdt.address,
    NEXT_PUBLIC_DAI_ADDRESS: manifest.external.dai.address,
    NEXT_PUBLIC_REGISTRY_ADDRESS: manifest.registries.campaignRegistry.address,
    NEXT_PUBLIC_PRODUCER_REGISTRY_ADDRESS:
      manifest.registries.producerRegistryV2.address,
    NEXT_PUBLIC_REPAYMENT_IMPL: currentModules.repayment,
    NEXT_PUBLIC_ECOMMERCE_IMPL: currentModules.ecommerce,
    NEXT_PUBLIC_DEBT_RESTRUCTURING_IMPL: currentModules.debtRestructuring,
    NEXT_PUBLIC_PROCEEDS_SPLIT_IMPL: currentModules.proceedsSplit,
    NEXT_PUBLIC_DIRECT_ISSUE_IMPL: currentModules.directIssue,
    NEXT_PUBLIC_PROJECT_UPDATES_IMPL: currentModules.projectUpdates,
    NEXT_PUBLIC_GROW_TOKEN: manifest.growSystem.token.proxy,
    NEXT_PUBLIC_GROW_TREASURY: manifest.growSystem.treasury.proxy,
    NEXT_PUBLIC_GROW_MINTER: manifest.growSystem.minter.proxy,
    NEXT_PUBLIC_GROW_FEE_SPLITTER: manifest.growSystem.feeSplitter.proxy,
    NEXT_PUBLIC_GROW_STAKING_POOL: manifest.growSystem.stakingPool.proxy,
  };
  for (const [key, address] of Object.entries(appAddresses)) {
    assertYamlEnv(appSpec, key, address);
  }

  const frontendContracts = readFileSync(
    resolve(repoRoot, "platform/frontend/src/contracts/index.ts"),
    "utf8",
  );
  for (const [key, address] of Object.entries(appAddresses)) {
    assertContains(frontendContracts, address, `Frontend ${key}`);
  }

  const backendSocial = readFileSync(
    resolve(repoRoot, "platform/backend/src/social-verification.ts"),
    "utf8",
  );
  assertContains(backendSocial, manifest.external.eas.address, "Backend EAS");
  assertContains(
    backendSocial,
    manifest.external.easSchemaRegistry.address,
    "Backend EAS SchemaRegistry",
  );

  const subgraph = readFileSync(
    resolve(repoRoot, "platform/subgraph/subgraph.yaml"),
    "utf8",
  );
  for (const address of [
    manifest.factory.proxy,
    manifest.registries.campaignRegistry.address,
    manifest.registries.legacyProducerRegistry.address,
    manifest.registries.producerRegistryV2.address,
    manifest.growSystem.token.proxy,
    manifest.growSystem.treasury.proxy,
    manifest.growSystem.minter.proxy,
    manifest.growSystem.feeSplitter.proxy,
  ]) {
    assertContains(subgraph, address, "Mainnet subgraph");
  }

  const adminSpec = readFileSync(resolve(repoRoot, ".do/admin.yaml"), "utf8");
  for (const address of [
    manifest.external.usdc.address,
    manifest.growSystem.feeSplitter.proxy,
    manifest.growSystem.treasury.proxy,
  ]) {
    assertContains(adminSpec, address, "Admin app spec");
  }
  const adminEnv = readFileSync(
    resolve(repoRoot, "platform/admin/.env.example"),
    "utf8",
  );
  assertEnv(adminEnv, "VITE_USDC_ADDRESS", manifest.external.usdc.address);
  assertEnv(
    adminEnv,
    "VITE_GROW_FEE_SPLITTER",
    manifest.growSystem.feeSplitter.proxy,
  );
  assertEnv(
    adminEnv,
    "VITE_GROW_TREASURY",
    manifest.growSystem.treasury.proxy,
  );
}

async function main() {
  assert(manifest.chainId === 1, "Manifest chain id must be 1");
  const [chainId, blockNumber] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber(),
  ]);
  assert(chainId === 1, `RPC chain id is ${chainId}, expected 1`);
  assert(
    blockNumber >= BigInt(manifest.verifiedAtBlock),
    `RPC is behind manifest block ${manifest.verifiedAtBlock}`,
  );

  await verifyFactory();
  await verifyGrowSystem();
  for (const [name, record] of Object.entries(manifest.registries)) {
    await assertImplementation(record, `Registry ${name}`);
  }
  await verifyExternal();
  await verifyProducerRegistryV2();
  await verifyModules();
  await verifyCampaigns();
  verifyDocumentation();

  console.log(
    `Verified Ethereum mainnet addresses and documentation at block ${blockNumber}.`,
  );
}

await main();
