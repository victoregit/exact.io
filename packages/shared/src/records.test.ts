import { describe, expect, it } from 'vitest';

import {
  EMPTY_SOLO_RECORDS,
  parseSoloRecords,
  updateSoloRecords,
} from './records';

describe('solo records', () => {
  it('creates records from the first completed session', () => {
    expect(
      updateSoloRecords(EMPTY_SOLO_RECORDS, {
        averageDifferenceMs: 82,
        bestScore: 920,
        bestDifferenceMs: 12,
      }),
    ).toEqual({
      bestAverageMs: 82,
      bestErrorMs: 12,
      gamesPlayed: 1,
      highScore: 920,
    });
  });

  it('only replaces records when the new result is better', () => {
    const records = {
      bestAverageMs: 82,
      bestErrorMs: 12,
      gamesPlayed: 4,
      highScore: 920,
    };

    expect(
      updateSoloRecords(records, {
        averageDifferenceMs: 90,
        bestScore: 900,
        bestDifferenceMs: 8,
      }),
    ).toEqual({
      bestAverageMs: 82,
      bestErrorMs: 8,
      gamesPlayed: 5,
      highScore: 920,
    });
  });

  it('parses valid storage and rejects invalid data', () => {
    const valid = {
      bestAverageMs: 50,
      bestErrorMs: 5,
      gamesPlayed: 2,
      highScore: 950,
    };

    expect(parseSoloRecords(JSON.stringify(valid))).toEqual(valid);
    expect(parseSoloRecords('{broken')).toEqual(EMPTY_SOLO_RECORDS);
    expect(parseSoloRecords(JSON.stringify({ gamesPlayed: -1 }))).toEqual(
      EMPTY_SOLO_RECORDS,
    );
  });
});
