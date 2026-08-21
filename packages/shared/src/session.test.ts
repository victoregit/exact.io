import { describe, expect, it } from 'vitest';

import { summarizeSession, type SessionRound } from './session';

const rounds: SessionRound[] = [
  { differenceMs: 8, precision: 'PERFECT', score: 960 },
  { differenceMs: 42, precision: 'INSANE', score: 830 },
  { differenceMs: 120, precision: 'GOOD', score: 560 },
  { differenceMs: 6, precision: 'PERFECT', score: 970 },
  { differenceMs: 300, precision: 'OK', score: 260 },
];

describe('summarizeSession', () => {
  it('summarizes a five-round session', () => {
    expect(summarizeSession(rounds)).toEqual({
      averageDifferenceMs: 95.2,
      bestRoundIndex: 3,
      perfects: 2,
      totalScore: 3_580,
      worstRoundIndex: 4,
    });
  });

  it('returns a safe empty summary', () => {
    expect(summarizeSession([])).toEqual({
      averageDifferenceMs: 0,
      bestRoundIndex: -1,
      perfects: 0,
      totalScore: 0,
      worstRoundIndex: -1,
    });
  });
});
