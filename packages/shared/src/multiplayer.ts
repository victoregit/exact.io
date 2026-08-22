export interface MultiplayerAttempt {
  contestantId: string;
  elapsedMs: number;
}

export interface TimeVerificationState {
  usedByIds: string[];
}

export interface ClosedRoundResult {
  bestDifferenceMs: number | null;
  bestElapsedMs: number | null;
  status: 'closed';
  winnerIds: string[];
}

export interface OpenRoundResult {
  status: 'open';
}

export type MultiplayerRoundResult = ClosedRoundResult | OpenRoundResult;

export interface ChampionshipStanding {
  contestantId: string;
  score: number;
}

export type ChampionshipResult =
  | { status: 'in_progress' }
  | { status: 'tiebreak'; tiedIds: string[] }
  | { championId: string; status: 'finished' };

export function getRoundDeadlineMs(targetMs: number): number {
  assertPositiveFinite(targetMs, 'O tempo-alvo deve ser positivo.');
  return targetMs * 2;
}

export function resolveMultiplayerRound(
  targetMs: number,
  elapsedSinceStartMs: number,
  attempts: MultiplayerAttempt[],
  expectedContestantIds: string[] = [],
): MultiplayerRoundResult {
  assertPositiveFinite(targetMs, 'O tempo-alvo deve ser positivo.');
  if (!Number.isFinite(elapsedSinceStartMs) || elapsedSinceStartMs < 0) {
    throw new RangeError('O tempo decorrido não pode ser negativo.');
  }

  const attemptedIds = new Set(
    attempts.map(({ contestantId }) => contestantId),
  );
  const everyonePlayed =
    expectedContestantIds.length > 0 &&
    expectedContestantIds.every((contestantId) =>
      attemptedIds.has(contestantId),
    );

  if (!everyonePlayed && elapsedSinceStartMs < getRoundDeadlineMs(targetMs)) {
    return { status: 'open' };
  }

  const validAttempts = attempts.filter(
    ({ contestantId, elapsedMs }) =>
      contestantId.length > 0 &&
      Number.isFinite(elapsedMs) &&
      elapsedMs >= 0 &&
      elapsedMs <= getRoundDeadlineMs(targetMs),
  );
  if (validAttempts.length === 0) {
    return {
      bestDifferenceMs: null,
      bestElapsedMs: null,
      status: 'closed',
      winnerIds: [],
    };
  }

  const bestDifferenceMs = Math.min(
    ...validAttempts.map(({ elapsedMs }) => Math.abs(elapsedMs - targetMs)),
  );
  const winners = validAttempts.filter(
    ({ elapsedMs }) => Math.abs(elapsedMs - targetMs) === bestDifferenceMs,
  );

  return {
    bestDifferenceMs,
    bestElapsedMs: winners[0].elapsedMs,
    status: 'closed',
    winnerIds: [...new Set(winners.map(({ contestantId }) => contestantId))],
  };
}

export function canVerifyTime(
  playerId: string,
  state: TimeVerificationState,
): boolean {
  return playerId.length > 0 && !state.usedByIds.includes(playerId);
}

export function useTimeVerification(
  playerId: string,
  state: TimeVerificationState,
): TimeVerificationState {
  if (!canVerifyTime(playerId, state)) {
    throw new Error(
      'Cada jogador só pode verificar o tempo uma vez por rodada.',
    );
  }
  return { usedByIds: [...state.usedByIds, playerId] };
}

export function resolveChampionship(
  standings: ChampionshipStanding[],
  completedRounds: number,
  scheduledRounds: number,
): ChampionshipResult {
  if (completedRounds < scheduledRounds) return { status: 'in_progress' };
  if (standings.length === 0) return { status: 'tiebreak', tiedIds: [] };

  const highestScore = Math.max(...standings.map(({ score }) => score));
  const leaders = standings.filter(({ score }) => score === highestScore);
  if (leaders.length > 1) {
    return {
      status: 'tiebreak',
      tiedIds: leaders.map(({ contestantId }) => contestantId),
    };
  }

  return { championId: leaders[0].contestantId, status: 'finished' };
}

function assertPositiveFinite(value: number, message: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(message);
}
