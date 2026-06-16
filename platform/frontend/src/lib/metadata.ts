import { useQuery } from "@tanstack/react-query";
import { useReadContracts } from "wagmi";
import type { Address } from "viem";
import { abis, CHAIN_ID, getAddresses } from "@/contracts";

const WAGMI_CHAIN_ID = CHAIN_ID as never;

export interface CampaignMetadata {
  name: string;
  description: string;
  location: string;
  productType: string;
  image: string | null;
  createdAt: number;
}

export interface ProducerProfile {
  name: string;
  bio: string;
  avatar: string | null;
  cover: string | null;
  website: string | null;
  location: string | null;
  updatedAt?: number;
}

export function useProducerProfile(
  uri: string | null | undefined,
  version: string | number | null | undefined,
) {
  return useQuery({
    queryKey: ["producer-profile", uri, String(version ?? 0)],
    enabled: !!uri,
    queryFn: async (): Promise<ProducerProfile | null> => {
      if (!uri) return null;
      try {
        const res = await fetch(uri, { cache: "force-cache" });
        if (!res.ok) return null;
        return (await res.json()) as ProducerProfile;
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    retry: 1,
  });
}

/**
 * Fetch the off-chain JSON metadata for a campaign.
 * The URI is whatever the producer wrote on-chain via CampaignRegistry.setMetadata
 * (currently pointing at DigitalOcean Spaces, but the hook doesn't care — any URL
 * that responds with the expected JSON shape works).
 *
 * Cached forever by React Query because the `version` field on the Campaign entity
 * lets us know when to invalidate — we include it in the queryKey.
 */
export function useCampaignMetadata(
  uri: string | null | undefined,
  version: string | number | null | undefined,
) {
  return useQuery({
    queryKey: ["campaign-metadata", uri, String(version ?? 0)],
    enabled: !!uri,
    queryFn: async (): Promise<CampaignMetadata | null> => {
      if (!uri) return null;
      try {
        const res = await fetch(uri, { cache: "force-cache" });
        if (!res.ok) return null;
        return (await res.json()) as CampaignMetadata;
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
    gcTime: 60 * 60_000, // 1h
    retry: 1,
  });
}

export function useResolvedCampaignMetadata(
  campaign: string | null | undefined,
  uri: string | null | undefined,
  version: string | number | null | undefined,
) {
  const { registry } = getAddresses();
  const hasSubgraphUri = Boolean(uri && uri.length > 0);
  const shouldReadRegistry =
    Boolean(campaign) &&
    !hasSubgraphUri &&
    registry !== "0x0000000000000000000000000000000000000000";

  const { data: registryReads } = useReadContracts({
    contracts: [
      {
        address: registry,
        abi: abis.CampaignRegistry,
        chainId: WAGMI_CHAIN_ID,
        functionName: "metadataURI",
        args: [campaign as Address],
      },
      {
        address: registry,
        abi: abis.CampaignRegistry,
        chainId: WAGMI_CHAIN_ID,
        functionName: "version",
        args: [campaign as Address],
      },
    ],
    query: {
      enabled: shouldReadRegistry,
      refetchInterval: shouldReadRegistry ? 15_000 : false,
    },
  });

  const registryUri =
    registryReads?.[0]?.status === "success"
      ? (registryReads[0].result as string)
      : null;
  const registryVersion =
    registryReads?.[1]?.status === "success"
      ? String(registryReads[1].result)
      : null;

  const resolvedUri = hasSubgraphUri ? uri : registryUri || null;
  const resolvedVersion = hasSubgraphUri ? version : registryVersion;

  return useCampaignMetadata(resolvedUri, resolvedVersion);
}
