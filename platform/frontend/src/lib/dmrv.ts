const DEFAULT_SILVI_MAP_BASE_URL = "https://silvi.growfi.dev";

export interface CampaignDmrvMetadata {
  provider: "silvi";
  projectId: string;
  url: string;
  embedUrl: string;
  geojsonUrl: string;
  linkedAt: number;
}

export function normalizeSilviProjectId(value: string) {
  return value.trim().replace(/[^\d]/g, "");
}

export function isValidSilviProjectId(value: string) {
  return /^[1-9]\d*$/.test(value.trim());
}

export function buildSilviDmrvMetadata(
  projectIdInput: string,
): CampaignDmrvMetadata | null {
  const projectId = normalizeSilviProjectId(projectIdInput);
  if (!isValidSilviProjectId(projectId)) return null;
  const baseUrl = normalizedSilviBaseUrl();
  return {
    provider: "silvi",
    projectId,
    url: `${baseUrl}/map/?project=${encodeURIComponent(projectId)}`,
    embedUrl: `${baseUrl}/map/iframe.html?project=${encodeURIComponent(projectId)}`,
    geojsonUrl: `${baseUrl}/api/silvi/projects/${encodeURIComponent(projectId)}/map.geojson`,
    linkedAt: Date.now(),
  };
}

function normalizedSilviBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_SILVI_MAP_BASE_URL?.trim();
  const raw = configured || DEFAULT_SILVI_MAP_BASE_URL;
  return raw.replace(/\/+$/, "");
}
