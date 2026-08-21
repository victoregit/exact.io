export const TARGET_TIME = { minMs: 3_000, maxMs: 15_000 } as const;

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
