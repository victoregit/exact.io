import { describe, expect, it } from 'vitest';

import {
  TARGET_TIME,
  calculateDifference,
  classifyPrecision,
  generateTargetMs,
} from './timing';

describe('timing', () => {
  it('calculates an absolute difference', () => {
    expect(calculateDifference(8_742, 8_759)).toBe(17);
    expect(calculateDifference(8_742, 8_700)).toBe(42);
  });

  it.each([
    [0, 'PERFECT'],
    [10, 'PERFECT'],
    [11, 'INSANE'],
    [50, 'INSANE'],
    [100, 'GREAT'],
    [250, 'GOOD'],
    [500, 'OK'],
    [501, 'MISS'],
  ] as const)('classifies %ims as %s', (differenceMs, expected) => {
    expect(classifyPrecision(differenceMs)).toBe(expected);
  });

  it('generates a non-round target inside the configured range', () => {
    const targetMs = generateTargetMs(() => 0.47851);

    expect(targetMs).toBeGreaterThanOrEqual(TARGET_TIME.minMs);
    expect(targetMs).toBeLessThanOrEqual(TARGET_TIME.maxMs);
    expect(targetMs % 100).not.toBe(0);
    expect(targetMs % 10).toBe(0);
  });

  it('retries when the random value produces a round target', () => {
    const values = [0, 0.5009];
    const targetMs = generateTargetMs(() => values.shift() ?? 0.5009);

    expect(targetMs).not.toBe(TARGET_TIME.minMs);
    expect(targetMs % 100).not.toBe(0);
  });
});
