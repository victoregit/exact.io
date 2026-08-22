import cors from '@fastify/cors';
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

  app.get('/health', async () => ({ status: 'ok' as const }));
  registerRankingRoutes(app, {
    now: options.now,
    repository: rankingsRepository,
    secret: options.rankingSecret ?? process.env.DEVICE_KEY_SECRET,
  });
  registerRealtime(app);
  app.addHook('onClose', async () => {
    await rankingsRepository?.close?.();
  });

  return app;
}
