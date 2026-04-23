const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
  filename: string;
}

export async function uploadImage(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BACKEND_URL}/api/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }

  return res.json();
}

export interface MetadataResult {
  key: string;
  url: string;
  metadata: {
    name: string;
    description: string;
    location: string;
    productType: string;
    image: string | null;
    createdAt: number;
  };
}

export async function uploadMetadata(input: {
  name: string;
  description: string;
  location: string;
  productType: string;
  imageUrl?: string;
}): Promise<MetadataResult> {
  const res = await fetch(`${BACKEND_URL}/api/metadata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Metadata upload failed" }));
    throw new Error(err.error || "Metadata upload failed");
  }

  return res.json();
}

export interface ProducerProfileResult {
  key: string;
  url: string;
  profile: {
    name: string;
    bio: string;
    avatar: string | null;
    cover: string | null;
    website: string | null;
    location: string | null;
    updatedAt: number;
  };
}

export interface MerkleProof {
  user: string;
  productAmount: string; // 18-dec
  proof: `0x${string}`[];
}

export async function fetchMerkleProof(
  campaign: string,
  seasonId: string | number | bigint,
  user: string,
): Promise<MerkleProof | null> {
  const res = await fetch(
    `${BACKEND_URL}/api/merkle/${campaign.toLowerCase()}/${seasonId}/${user.toLowerCase()}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Merkle fetch failed: ${res.status}`);
  return res.json();
}

export interface MerkleGenerateResult {
  root: `0x${string}`;
  url: string;
  count: number;
}

export interface SnapshotResult {
  campaign: string;
  seasonId: string;
  stakingVault: string;
  yieldToken: string;
  /** Sum of all holders' yieldAmount (18-dec string). */
  totalYield: string;
  /** Expected season-scoped total from StakingVault.seasonTotalYieldOwed; null if not exposed. */
  seasonTotalYieldOwed: string | null;
  holders: Array<{ user: string; yieldAmount: string }>;
  notes: string[];
}

export async function fetchSnapshot(
  campaign: string,
  seasonId: string | number | bigint,
): Promise<SnapshotResult> {
  const res = await fetch(
    `${BACKEND_URL}/api/snapshot/${campaign}/${String(seasonId)}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Snapshot failed" }));
    throw new Error(err.error || `Snapshot failed: ${res.status}`);
  }
  return res.json();
}

export async function generateMerkleTree(input: {
  campaign: string;
  seasonId: string | number | bigint;
  totalProductUnits: string;
  holders: Array<{ user: string; yieldAmount: string }>;
  minProductClaim?: string;
}): Promise<MerkleGenerateResult> {
  const body = {
    ...input,
    seasonId: String(input.seasonId),
  };
  const res = await fetch(`${BACKEND_URL}/api/merkle/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Merkle gen failed" }));
    throw new Error(err.error || "Merkle gen failed");
  }
  return res.json();
}

export async function uploadProducerProfile(input: {
  name: string;
  bio: string;
  avatar?: string | null;
  cover?: string | null;
  website?: string | null;
  location?: string | null;
}): Promise<ProducerProfileResult> {
  const res = await fetch(`${BACKEND_URL}/api/producer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Profile upload failed" }));
    throw new Error(err.error || "Profile upload failed");
  }

  return res.json();
}
