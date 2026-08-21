import { describe, expect, it } from 'vitest';

import { SCORE_CURVE, calculateScore } from './scoring';

describe('calculateScore', () => {
  it.each(SCORE_CURVE)(
    'returns $score points at $differenceMs ms',
    ({ differenceMs, score }) => {
      expect(calculateScore(differenceMs)).toBe(score);
    },
  );

  it('interpolates gradually between curve anchors', () => {
    expect(calculateScore(30)).toBe(8_750);
    expect(calculateScore(175)).toBe(4_500);
    expect(calculateScore(750)).toBe(550);
  });

  it('stays between zero and ten thousand', () => {
    expect(calculateScore(-10)).toBe(10_000);
    expect(calculateScore(5_000)).toBe(0);
  });

  it('decreases as the error increases', () => {
    const scores = [0, 5, 25, 75, 200, 400, 800, 1_500, 2_500].map(
      calculateScore,
    );
    expect(
      scores.every((score, index) => index === 0 || score <= scores[index - 1]),
    ).toBe(true);
  });
});
