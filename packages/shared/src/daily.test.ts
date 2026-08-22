import { describe, expect, it } from 'vitest';

import {
  getLocalDateKey,
  getSaoPauloDateKey,
  parseDailyResult,
  updateDailyResult,
} from './daily';

describe('daily result', () => {
  it('uses the local calendar date as its key', () => {
    expect(getLocalDateKey(new Date(2026, 7, 22, 23, 59))).toBe('2026-08-22');
  });

  it('uses the São Paulo calendar day for the global ranking', () => {
    expect(getSaoPauloDateKey(new Date('2026-08-22T02:30:00Z'))).toBe(
      '2026-08-21',
    );
  });

  it('keeps only the strongest result from the day', () => {
    const current = {
      date: '2026-08-22',
      bestScore: 900,
      bestDifferenceMs: 20,
    };

    expect(
      updateDailyResult(current, {
        date: '2026-08-22',
        bestScore: 920,
        bestDifferenceMs: 30,
      }),
    ).toEqual({ date: '2026-08-22', bestScore: 920, bestDifferenceMs: 30 });
    expect(
      updateDailyResult(current, {
        date: '2026-08-22',
        bestScore: 900,
        bestDifferenceMs: 25,
      }),
    ).toEqual(current);
  });

  it('starts a fresh result on a new day', () => {
    const candidate = {
      date: '2026-08-23',
      bestScore: 700,
      bestDifferenceMs: 80,
    };
    expect(
      updateDailyResult(
        { date: '2026-08-22', bestScore: 950, bestDifferenceMs: 10 },
        candidate,
      ),
    ).toEqual(candidate);
  });

  it('parses valid data and rejects malformed storage', () => {
    const result = { date: '2026-08-22', bestScore: 950, bestDifferenceMs: 10 };
    expect(parseDailyResult(JSON.stringify(result))).toEqual(result);
    expect(parseDailyResult('{broken')).toBeNull();
    expect(
      parseDailyResult(JSON.stringify({ ...result, bestScore: -1 })),
    ).toBeNull();
  });
});
