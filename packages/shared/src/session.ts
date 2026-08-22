import type { PrecisionLabel } from './timing.js';

export interface SessionRound {
  differenceMs: number;
  precision: PrecisionLabel;
  score: number;
}

export interface SessionSummary {
  averageDifferenceMs: number;
  bestScore: number;
  bestRoundIndex: number;
  perfects: number;
  worstRoundIndex: number;
}

export function summarizeSession(rounds: SessionRound[]): SessionSummary {
  if (rounds.length === 0) {
    return {
      averageDifferenceMs: 0,
      bestScore: 0,
      bestRoundIndex: -1,
      perfects: 0,
      worstRoundIndex: -1,
    };
  }

  let bestRoundIndex = 0;
  let worstRoundIndex = 0;
  let differenceTotal = 0;
  let perfects = 0;
  let bestScore = 0;

  rounds.forEach((round, index) => {
    differenceTotal += round.differenceMs;
    bestScore = Math.max(bestScore, round.score);
    if (round.precision === 'PERFECT') perfects += 1;
    if (round.differenceMs < rounds[bestRoundIndex].differenceMs)
      bestRoundIndex = index;
    if (round.differenceMs > rounds[worstRoundIndex].differenceMs)
      worstRoundIndex = index;
  });

  return {
    averageDifferenceMs: differenceTotal / rounds.length,
    bestScore,
    bestRoundIndex,
    perfects,
    worstRoundIndex,
  };
}
