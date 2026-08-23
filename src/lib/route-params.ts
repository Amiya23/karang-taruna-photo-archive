export function parseYearParam(raw: string): number | null {
  if (!/^\d{4}$/.test(raw)) return null;
  const year = Number(raw);
  if (year < 1900 || year > 2999) return null;
  return year;
}
