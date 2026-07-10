import {
  getAddress,
  keccak256,
  toBytes,
  type Address,
} from "viem";

export interface MerklePublicationInput {
  campaign: string;
  seasonId: string | number | bigint;
  totalProductUnits: string;
  totalYieldSupply: string;
  holders: Array<{ user: string; yieldAmount: string }>;
  minProductClaim?: string;
}

export function buildMerklePublicationMessage(
  input: MerklePublicationInput,
  expiresAt: number,
): string {
  const campaign = getAddress(input.campaign);
  const seasonId = BigInt(input.seasonId).toString();
  const payloadHash = merklePublicationPayloadHash(input);
  return [
    "GrowFi Merkle publication",
    `Campaign: ${campaign}`,
    `Season: ${seasonId}`,
    `Payload hash: ${payloadHash}`,
    `Expires at: ${expiresAt}`,
  ].join("\n");
}

export function merklePublicationPayloadHash(input: MerklePublicationInput): `0x${string}` {
  const canonical = {
    campaign: getAddress(input.campaign).toLowerCase() as Address,
    seasonId: BigInt(input.seasonId).toString(),
    totalProductUnits: BigInt(input.totalProductUnits).toString(),
    totalYieldSupply: BigInt(input.totalYieldSupply).toString(),
    minProductClaim: BigInt(input.minProductClaim ?? "0").toString(),
    holders: input.holders
      .map((holder) => ({
        user: getAddress(holder.user).toLowerCase() as Address,
        yieldAmount: BigInt(holder.yieldAmount).toString(),
      }))
      .sort((a, b) => a.user.localeCompare(b.user)),
  };
  return keccak256(toBytes(JSON.stringify(canonical)));
}
