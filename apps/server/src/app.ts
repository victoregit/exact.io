import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import {
  createPostgresRankingsRepository,
  type RankingsRepository,
} from './rankings/repository.js';
import { registerRankingRoutes } from './rankings/routes.js';
import { registerRealtime } from './realtime.js';

interface BuildAppOptions {
  now?: () => Date;
  rankingsRepository?: RankingsRepository | null;
  rankingSecret?: string;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const rankingsRepository =
    options.rankingsRepository === undefined
      ? createPostgresRankingsRepository()
      : options.rankingsRepository;

  void app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  });
  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok' as const,
  }));
  app.get(
    '/ready',
    { config: { rateLimit: false } },
    async (_request, reply) => {
      if (!rankingsRepository) {
        return reply.code(503).send({ database: 'not_configured' });
      }
      try {
        await rankingsRepository.ping();
        return { database: 'ready' };
      } catch {
        return reply.code(503).send({ database: 'unavailable' });
      }
    },
  );
  void app.register(async (rankingApp) => {
    await rankingApp.register(rateLimit, {
      global: true,
      max: 300,
      timeWindow: '1 minute',
    });
    registerRankingRoutes(rankingApp, {
      now: options.now,
      repository: rankingsRepository,
      secret: options.rankingSecret ?? process.env.DEVICE_KEY_SECRET,
    });
  });
  registerRealtime(app);
  app.addHook('onClose', async () => {
    await rankingsRepository?.close?.();
  });

  return app;
}
