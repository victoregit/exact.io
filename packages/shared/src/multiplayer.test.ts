import { describe, expect, it } from 'vitest';

import {
  canVerifyTime,
  getRoundDeadlineMs,
  resolveChampionship,
  resolveMultiplayerRound,
  useTimeVerification,
} from './multiplayer.js';

describe('multiplayer round rules', () => {
  it('keeps a 7 second target open until 14 seconds', () => {
    expect(getRoundDeadlineMs(7_000)).toBe(14_000);
    expect(
      resolveMultiplayerRound(7_000, 13_999, [
        { contestantId: 'A', elapsedMs: 7_010 },
      ]),
    ).toEqual({ status: 'open' });
  });

  it('closes at double the target and saves the closest result', () => {
    expect(
      resolveMultiplayerRound(7_000, 14_000, [
        { contestantId: 'A', elapsedMs: 7_080 },
        { contestantId: 'C', elapsedMs: 6_990 },
        { contestantId: 'B', elapsedMs: 7_030 },
      ]),
    ).toEqual({
      bestDifferenceMs: 10,
      bestElapsedMs: 6_990,
      status: 'closed',
      winnerIds: ['C'],
    });
  });

  it('closes as soon as every player has made an attempt', () => {
    expect(
      resolveMultiplayerRound(
        7_000,
        9_000,
        [
          { contestantId: 'A', elapsedMs: 7_080 },
          { contestantId: 'B', elapsedMs: 6_990 },
        ],
        ['A', 'B'],
      ),
    ).toMatchObject({ status: 'closed', winnerIds: ['B'] });
  });

  it('waits when at least one player has not played and the limit remains open', () => {
    expect(
      resolveMultiplayerRound(
        7_000,
        9_000,
        [{ contestantId: 'A', elapsedMs: 7_080 }],
        ['A', 'B'],
      ),
    ).toEqual({ status: 'open' });
  });

  it('reports every tied closest player', () => {
    expect(
      resolveMultiplayerRound(7_000, 14_000, [
        { contestantId: 'A', elapsedMs: 6_990 },
        { contestantId: 'D', elapsedMs: 7_010 },
      ]),
    ).toMatchObject({ status: 'closed', winnerIds: ['A', 'D'] });
  });

  it('ignores attempts made after the deadline', () => {
    expect(
      resolveMultiplayerRound(7_000, 14_000, [
        { contestantId: 'A', elapsedMs: 14_001 },
      ]),
    ).toMatchObject({ bestElapsedMs: null, winnerIds: [] });
  });
});

describe('time verification', () => {
  it('allows each player to verify only once per round', () => {
    const initial = { usedByIds: [] };
    const afterA = useTimeVerification('A', initial);

    expect(canVerifyTime('A', afterA)).toBe(false);
    expect(canVerifyTime('B', afterA)).toBe(true);
    expect(() => useTimeVerification('A', afterA)).toThrow(
      'Cada jogador só pode verificar o tempo uma vez por rodada.',
    );
  });
});

describe('championship rules', () => {
  const standings = [
    { contestantId: 'AB', score: 4 },
    { contestantId: 'CD', score: 1 },
  ];

  it('never announces the champion before all scheduled rounds end', () => {
    expect(resolveChampionship(standings, 4, 5)).toEqual({
      status: 'in_progress',
    });
  });

  it('announces the champion only after the final round', () => {
    expect(resolveChampionship(standings, 5, 5)).toEqual({
      championId: 'AB',
      status: 'finished',
    });
  });

  it('requests an extra round when the final score is tied', () => {
    expect(
      resolveChampionship(
        [
          { contestantId: 'AB', score: 3 },
          { contestantId: 'CD', score: 3 },
        ],
        5,
        5,
      ),
    ).toEqual({ status: 'tiebreak', tiedIds: ['AB', 'CD'] });
  });
});
