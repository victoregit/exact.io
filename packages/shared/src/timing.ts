export const TARGET_TIME = { minMs: 3_000, maxMs: 10_000 } as const;

export const PRECISION_THRESHOLDS = [
  { maxDifferenceMs: 10, label: 'PERFECT' },
  { maxDifferenceMs: 50, label: 'INSANE' },
  { maxDifferenceMs: 100, label: 'GREAT' },
  { maxDifferenceMs: 250, label: 'GOOD' },
  { maxDifferenceMs: 500, label: 'OK' },
] as const;

export type PrecisionLabel =
  (typeof PRECISION_THRESHOLDS)[number]['label'] | 'MISS';

export function calculateDifference(
  targetMs: number,
  actualMs: number,
): number {
  return Math.abs(actualMs - targetMs);
}

export function classifyPrecision(differenceMs: number): PrecisionLabel {
  return (
    PRECISION_THRESHOLDS.find(
      ({ maxDifferenceMs }) => differenceMs <= maxDifferenceMs,
    )?.label ?? 'MISS'
  );
}

export function generateTargetMs(random: () => number = Math.random): number {
  const minCentiseconds = TARGET_TIME.minMs / 10;
  const maxCentiseconds = TARGET_TIME.maxMs / 10;
  const range = maxCentiseconds - minCentiseconds + 1;
  let targetMs: number;

  do {
    targetMs = (minCentiseconds + Math.floor(random() * range)) * 10;
  } while (targetMs % 100 === 0);

  return targetMs;
}

export function generateDailyTargetMs(
  dateKey: string,
  roundIndex: number,
): number {
  return generateTargetMs(createSeededRandom(`${dateKey}:${roundIndex}`));
}

function createSeededRandom(seed: string): () => number {
  let state = 2_166_136_261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16_777_619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
