export const SCORE_CURVE = [
  { differenceMs: 0, score: 1_000 },
  { differenceMs: 10, score: 950 },
  { differenceMs: 50, score: 800 },
  { differenceMs: 100, score: 600 },
  { differenceMs: 250, score: 300 },
  { differenceMs: 500, score: 100 },
  { differenceMs: 1_000, score: 10 },
  { differenceMs: 2_000, score: 0 },
] as const;

export function calculateScore(differenceMs: number): number {
  const normalizedDifference = Math.max(0, differenceMs);

  for (let index = 1; index < SCORE_CURVE.length; index += 1) {
    const lower = SCORE_CURVE[index - 1];
    const upper = SCORE_CURVE[index];

    if (normalizedDifference <= upper.differenceMs) {
      const progress =
        (normalizedDifference - lower.differenceMs) /
        (upper.differenceMs - lower.differenceMs);
      return Math.round(lower.score + progress * (upper.score - lower.score));
    }
  }

  return 0;
}
