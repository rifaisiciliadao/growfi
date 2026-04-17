import { keccak256, encodePacked, getAddress, type Address } from "viem";
import { MerkleTree } from "merkletreejs";

export interface HarvestLeaf {
  user: Address;
  productAmount: bigint; // 18-dec
}

/**
 * Compute the leaf hash exactly as HarvestManager.redeemProduct does:
 *   bytes32 leaf = keccak256(abi.encodePacked(msg.sender, seasonId, productAmount));
 */
export function computeLeaf(
  user: Address,
  seasonId: bigint,
  productAmount: bigint,
): `0x${string}` {
  return keccak256(
    encodePacked(
      ["address", "uint256", "uint256"],
      [user, seasonId, productAmount],
    ),
  );
}

/**
 * Build a Merkle tree compatible with OpenZeppelin MerkleProof.verify.
 * OZ sorts pairs at each level → merkletreejs `sortPairs: true`.
 */
export function buildTree(seasonId: bigint, leaves: HarvestLeaf[]) {
  if (leaves.length === 0) {
    throw new Error("Cannot build tree with zero leaves");
  }

  const hashedLeaves = leaves.map((l) =>
    Buffer.from(
      computeLeaf(getAddress(l.user), seasonId, l.productAmount).slice(2),
      "hex",
    ),
  );

  const tree = new MerkleTree(hashedLeaves, keccakBuffer, {
    sortPairs: true,
  });

  const root = ("0x" + tree.getRoot().toString("hex")) as `0x${string}`;

  const proofs: Record<string, `0x${string}`[]> = {};
  leaves.forEach((l, i) => {
    const proof = tree
      .getProof(hashedLeaves[i])
      .map((p) => ("0x" + p.data.toString("hex")) as `0x${string}`);
    proofs[getAddress(l.user).toLowerCase()] = proof;
  });

  return { root, proofs };
}

// merkletreejs expects a sync hash fn (Buffer → Buffer)
function keccakBuffer(data: Buffer): Buffer {
  const hex = keccak256(("0x" + data.toString("hex")) as `0x${string}`);
  return Buffer.from(hex.slice(2), "hex");
}
