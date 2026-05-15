export type ParsedProductType = {
  assetType: string;
  productType: string;
  encoded: boolean;
};

const PRODUCT_UNIT: Record<string, string> = {
  olive: "kg",
  olives: "kg",
  "olive-oil": "L",
  citrus: "kg",
  grape: "kg",
  grapes: "kg",
  wine: "bottles",
  honey: "jars",
  nuts: "kg",
};

const TITLE_OVERRIDES: Record<string, string> = {
  ha: "ha",
  "olive-oil": "Olive Oil",
};

export function normalizeProductSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function encodeProductType(assetType: string, productType: string): string {
  const asset = normalizeProductSegment(assetType);
  const product = normalizeProductSegment(productType);

  if (asset && product) return `${asset}:${product}`;
  return product || asset;
}

export function parseProductType(
  productType: string | undefined | null,
): ParsedProductType {
  const raw = productType?.trim() ?? "";
  if (!raw) return { assetType: "", productType: "", encoded: false };

  const separator = raw.indexOf(":");
  if (separator >= 0) {
    return {
      assetType: raw.slice(0, separator).trim(),
      productType: raw.slice(separator + 1).trim(),
      encoded: true,
    };
  }

  return { assetType: "tree", productType: raw, encoded: false };
}

export function titleizeProductSegment(value: string | undefined | null): string {
  const key = normalizeProductSegment(value ?? "");
  if (!key) return "";
  if (TITLE_OVERRIDES[key]) return TITLE_OVERRIDES[key];

  return key
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function productTypeDisplayLabel(
  productType: string | undefined | null,
): string {
  return titleizeProductSegment(parseProductType(productType).productType);
}

export function assetTypeDisplayLabel(
  productType: string | undefined | null,
): string {
  return titleizeProductSegment(parseProductType(productType).assetType);
}

export function assetProductDisplayLabel(
  productType: string | undefined | null,
): string {
  const parsed = parseProductType(productType);
  const asset = titleizeProductSegment(parsed.assetType);
  const product = titleizeProductSegment(parsed.productType);

  if (asset && product) return `${asset} · ${product}`;
  return product || asset;
}

/**
 * Display label for the product quantity in `expectedAnnualHarvest`.
 * The on-chain value is opaque (1e18 internal scale); the UI labels it via
 * the metadata product type. New metadata is encoded as `asset:product`, while
 * legacy metadata keeps the original single product value.
 */
export function productUnitLabel(productType: string | undefined | null): string {
  if (!productType) return "units";
  const key = normalizeProductSegment(parseProductType(productType).productType);
  return PRODUCT_UNIT[key] ?? "units";
}
