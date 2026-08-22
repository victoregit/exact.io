export interface SoloRecords {
  bestAverageMs: number | null;
  bestErrorMs: number | null;
  gamesPlayed: number;
  highScore: number;
}

export interface CompletedSession {
  averageDifferenceMs: number;
  bestScore: number;
  bestDifferenceMs: number;
}

export const EMPTY_SOLO_RECORDS: SoloRecords = {
  bestAverageMs: null,
  bestErrorMs: null,
  gamesPlayed: 0,
  highScore: 0,
};

export function updateSoloRecords(
  records: SoloRecords,
  session: CompletedSession,
): SoloRecords {
  return {
    bestAverageMs:
      records.bestAverageMs === null
        ? session.averageDifferenceMs
        : Math.min(records.bestAverageMs, session.averageDifferenceMs),
    bestErrorMs:
      records.bestErrorMs === null
        ? session.bestDifferenceMs
        : Math.min(records.bestErrorMs, session.bestDifferenceMs),
    gamesPlayed: records.gamesPlayed + 1,
    highScore: Math.max(records.highScore, session.bestScore),
  };
}

export function parseSoloRecords(value: string | null): SoloRecords {
  if (!value) return EMPTY_SOLO_RECORDS;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isSoloRecords(parsed)) return EMPTY_SOLO_RECORDS;
    return parsed;
  } catch {
    return EMPTY_SOLO_RECORDS;
  }
}

function isSoloRecords(value: unknown): value is SoloRecords {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;

  return (
    isNullableNonNegativeNumber(candidate.bestAverageMs) &&
    isNullableNonNegativeNumber(candidate.bestErrorMs) &&
    isNonNegativeNumber(candidate.gamesPlayed) &&
    Number.isInteger(candidate.gamesPlayed) &&
    isNonNegativeNumber(candidate.highScore)
  );
}

function isNullableNonNegativeNumber(value: unknown): boolean {
  return value === null || isNonNegativeNumber(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
