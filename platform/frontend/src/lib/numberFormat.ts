export function formatYieldRate(value: number, locale: string) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return value.toLocaleString(locale, {
    maximumFractionDigits: 2,
  });
}
