import pg from 'pg';

export type RankingPeriod = 'daily' | 'monthly' | 'weekly';

export interface DailyBestInput {
  deviceKeyHash: string;
  differenceMs: number;
  elapsedMs: number;
  nickname: string;
  playedOn: string;
  score: number;
  targetMs: number;
}

export interface RankingEntry {
  bestDifferenceMs: number;
  daysPlayed: number;
  nickname: string;
  position: number;
  totalScore: number;
}

export interface RankingsRepository {
  close?(): Promise<void>;
  getRanking(
    period: RankingPeriod,
    periodStart: string,
    limit: number,
  ): Promise<RankingEntry[]>;
  submitDailyBest(input: DailyBestInput): Promise<void>;
}

export function createPostgresRankingsRepository(
  connectionString = process.env.DATABASE_URL,
): RankingsRepository | null {
  if (!connectionString) return null;
  const pool = new pg.Pool({ connectionString, max: 10 });
  const views: Record<RankingPeriod, string> = {
    daily: 'ranking_daily',
    monthly: 'ranking_monthly',
    weekly: 'ranking_weekly',
  };

  return {
    async close() {
      await pool.end();
    },
    async getRanking(period, periodStart, limit) {
      const result = await pool.query<{
        best_difference_ms: number;
        days_played: string;
        nickname: string;
        position: string;
        total_score: string;
      }>(
        `select nickname, total_score, best_difference_ms, days_played, position
         from public.${views[period]}
         where period_start = $1::date
         order by position asc, nickname asc
         limit $2`,
        [periodStart, limit],
      );
      return result.rows.map((row) => ({
        bestDifferenceMs: row.best_difference_ms,
        daysPlayed: Number(row.days_played),
        nickname: row.nickname,
        position: Number(row.position),
        totalScore: Number(row.total_score),
      }));
    },

    async submitDailyBest(input) {
      await pool.query(
        `select public.submit_solo_daily_best($1, $2, $3::date, $4, $5, $6, $7)`,
        [
          input.deviceKeyHash,
          input.nickname,
          input.playedOn,
          input.score,
          input.differenceMs,
          input.targetMs,
          input.elapsedMs,
        ],
      );
    },
  };
}
