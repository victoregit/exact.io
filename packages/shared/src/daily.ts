export interface DailyResult {
  bestDifferenceMs: number;
  bestScore: number;
  date: string;
}

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function updateDailyResult(
  current: DailyResult | null,
  candidate: DailyResult,
): DailyResult {
  if (!current || current.date !== candidate.date) return candidate;
  if (candidate.bestScore > current.bestScore) return candidate;
  if (
    candidate.bestScore === current.bestScore &&
    candidate.bestDifferenceMs < current.bestDifferenceMs
  ) {
    return candidate;
  }
  return current;
}

export function parseDailyResult(value: string | null): DailyResult | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(candidate.date) ||
      !isNonNegativeNumber(candidate.bestScore) ||
      !isNonNegativeNumber(candidate.bestDifferenceMs)
    ) {
      return null;
    }
    return candidate as unknown as DailyResult;
  } catch {
    return null;
  }
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
