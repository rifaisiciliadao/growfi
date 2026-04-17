import { useQuery } from "@tanstack/react-query";

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
