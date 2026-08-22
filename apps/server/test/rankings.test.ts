import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type {
  DailyBestInput,
  RankingsRepository,
} from '../src/rankings/repository.js';

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function createRepository() {
  const submitDailyBest = vi.fn<(input: DailyBestInput) => Promise<void>>(
    async () => undefined,
  );
  const repository: RankingsRepository = {
    getRanking: vi.fn(async () => [
      {
        bestDifferenceMs: 4,
        daysPlayed: 3,
        nickname: 'Victor',
        position: 1,
        totalScore: 2_950,
      },
    ]),
    ping: vi.fn(async () => undefined),
    submitDailyBest,
  };
  return { repository, submitDailyBest };
}

describe('ranking API', () => {
  it('returns the weekly ranking starting on Monday', async () => {
    const { repository } = createRepository();
    const app = buildApp({
      now: () => new Date('2026-08-22T15:00:00Z'),
      rankingsRepository: repository,
      rankingSecret: 'test-secret',
    });
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/rankings/weekly?limit=20',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      period: 'weekly',
      periodStart: '2026-08-17',
    });
    expect(repository.getRanking).toHaveBeenCalledWith(
      'weekly',
      '2026-08-17',
      20,
    );
  });

  it('calculates and submits the daily result on the server', async () => {
    const { repository, submitDailyBest } = createRepository();
    const app = buildApp({
      now: () => new Date('2026-08-22T15:00:00Z'),
      rankingsRepository: repository,
      rankingSecret: 'test-secret',
    });
    apps.push(app);

    const response = await app.inject({
      body: {
        deviceKey: 'device-key-with-enough-entropy',
        elapsedMs: 7_000,
        nickname: 'Victor',
        playedOn: '2026-08-22',
        roundIndex: 0,
      },
      method: 'POST',
      url: '/rankings/daily',
    });

    expect(response.statusCode).toBe(200);
    expect(submitDailyBest).toHaveBeenCalledOnce();
    expect(submitDailyBest.mock.calls[0][0]).toMatchObject({
      deviceKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      elapsedMs: 7_000,
      nickname: 'Victor',
      playedOn: '2026-08-22',
    });
  });

  it('rejects results from another day', async () => {
    const { repository, submitDailyBest } = createRepository();
    const app = buildApp({
      now: () => new Date('2026-08-22T15:00:00Z'),
      rankingsRepository: repository,
      rankingSecret: 'test-secret',
    });
    apps.push(app);

    const response = await app.inject({
      body: {
        deviceKey: 'device-key-with-enough-entropy',
        elapsedMs: 7_000,
        nickname: 'Victor',
        playedOn: '2026-08-21',
        roundIndex: 0,
      },
      method: 'POST',
      url: '/rankings/daily',
    });

    expect(response.statusCode).toBe(400);
    expect(submitDailyBest).not.toHaveBeenCalled();
  });

  it('reports database readiness', async () => {
    const { repository } = createRepository();
    const app = buildApp({ rankingsRepository: repository });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ database: 'ready' });
    expect(repository.ping).toHaveBeenCalledOnce();
  });

  it('limits daily submissions per client', async () => {
    const { repository } = createRepository();
    const app = buildApp({
      now: () => new Date('2026-08-22T15:00:00Z'),
      rankingsRepository: repository,
      rankingSecret: 'test-secret',
    });
    apps.push(app);
    const request = {
      body: {
        deviceKey: 'device-key-with-enough-entropy',
        elapsedMs: 7_000,
        nickname: 'Victor',
        playedOn: '2026-08-22',
        roundIndex: 0,
      },
      method: 'POST' as const,
      url: '/rankings/daily',
    };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await app.inject(request)).statusCode).toBe(200);
    }
    expect((await app.inject(request)).statusCode).toBe(429);
  });
});
