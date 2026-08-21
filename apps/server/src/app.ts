import cors from '@fastify/cors';
import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  void app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  });

  app.get('/health', async () => ({ status: 'ok' as const }));

  return app;
}
