import { getAddresses } from "@/contracts";

export function getProtocolLabel(
  address: string | undefined | null,
): string | null {
  const key = address?.toLowerCase();
  if (!key) return null;

  const a = getAddresses();
  const labels: Array<[string | undefined, string]> = [
    [a.growTreasury, "GrowFi Treasury"],
    [a.growMinter, "GROW Minter"],
    [a.growFeeSplitter, "Fee Splitter"],
    [a.growStakingPool, "Staking Pool"],
  ];

  return (
    labels.find(([candidate]) => candidate?.toLowerCase() === key)?.[1] ?? null
  );
}

export function protocolInitials(label: string): string {
  return label
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
