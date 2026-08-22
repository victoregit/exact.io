import { createHmac } from 'node:crypto';

import {
  calculateDifference,
  calculateScore,
  generateDailyTargetMs,
} from '@exact-io/shared';
import type { FastifyInstance } from 'fastify';

import type { RankingPeriod, RankingsRepository } from './repository.js';

interface RankingRoutesOptions {
  now?: () => Date;
  repository: RankingsRepository | null;
  secret?: string;
}

export function registerRankingRoutes(
  app: FastifyInstance,
  { now = () => new Date(), repository, secret }: RankingRoutesOptions,
) {
  app.get<{ Params: { period: string }; Querystring: { limit?: string } }>(
    '/rankings/:period',
    async (request, reply) => {
      if (!repository)
        return reply.code(503).send({ message: 'Ranking indisponível.' });
      if (!isRankingPeriod(request.params.period)) {
        return reply.code(400).send({ message: 'Período inválido.' });
      }
      const limit = Math.min(
        100,
        Math.max(1, Number(request.query.limit) || 50),
      );
      const today = getSaoPauloDate(now());
      const periodStart = getPeriodStart(request.params.period, today);
      const entries = await repository.getRanking(
        request.params.period,
        periodStart,
        limit,
      );
      return { entries, period: request.params.period, periodStart };
    },
  );

  app.post<{
    Body: {
      deviceKey?: string;
      elapsedMs?: number;
      nickname?: string;
      playedOn?: string;
      roundIndex?: number;
    };
  }>('/rankings/daily', async (request, reply) => {
    if (!repository || !secret) {
      return reply.code(503).send({ message: 'Ranking indisponível.' });
    }
    const { deviceKey, elapsedMs, nickname, playedOn, roundIndex } =
      request.body ?? {};
    const today = getSaoPauloDate(now());
    if (
      typeof deviceKey !== 'string' ||
      deviceKey.length < 16 ||
      typeof nickname !== 'string' ||
      nickname.trim().length < 2 ||
      nickname.trim().length > 16 ||
      playedOn !== today ||
      !Number.isInteger(roundIndex) ||
      (roundIndex ?? -1) < 0 ||
      (roundIndex ?? 5) > 4 ||
      typeof elapsedMs !== 'number' ||
      !Number.isFinite(elapsedMs) ||
      elapsedMs < 0 ||
      elapsedMs > 20_000
    ) {
      return reply.code(400).send({ message: 'Resultado inválido.' });
    }

    const targetMs = generateDailyTargetMs(playedOn, roundIndex as number);
    const roundedElapsedMs = Math.round(elapsedMs);
    const differenceMs = calculateDifference(targetMs, roundedElapsedMs);
    const score = calculateScore(differenceMs);
    await repository.submitDailyBest({
      deviceKeyHash: createHmac('sha256', secret)
        .update(deviceKey)
        .digest('hex'),
      differenceMs,
      elapsedMs: roundedElapsedMs,
      nickname: nickname.trim(),
      playedOn,
      score,
      targetMs,
    });
    return { differenceMs, ok: true, score, targetMs };
  });
}

function getSaoPauloDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
  }).format(date);
}

function getPeriodStart(period: RankingPeriod, today: string): string {
  if (period === 'daily') return today;
  const date = new Date(`${today}T12:00:00Z`);
  if (period === 'monthly') return `${today.slice(0, 7)}-01`;
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}

function isRankingPeriod(value: string): value is RankingPeriod {
  return value === 'daily' || value === 'weekly' || value === 'monthly';
}
