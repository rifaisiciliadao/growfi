/**
 * Display label for the product quantity in `expectedAnnualHarvest`.
 * The on-chain value is opaque (1e18 internal scale); the UI labels it via
 * the off-chain `productType` set in metadata at create time.
 *
 * Keep in sync with `PRODUCT_KEYS` in /create.
 */
const PRODUCT_UNIT: Record<string, string> = {
  "olive-oil": "L",
  citrus: "kg",
  wine: "bottles",
  honey: "jars",
  nuts: "kg",
};

export function productUnitLabel(productType: string | undefined | null): string {
  if (!productType) return "units";
  const key = productType.toLowerCase().trim();
  return PRODUCT_UNIT[key] ?? "units";
}
