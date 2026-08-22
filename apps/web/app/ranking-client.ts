export type RankingPeriod = 'daily' | 'monthly' | 'weekly';

export interface RankingEntry {
  bestDifferenceMs: number;
  daysPlayed: number;
  nickname: string;
  position: number;
  totalScore: number;
}

export interface RankingResponse {
  entries: RankingEntry[];
  period: RankingPeriod;
  periodStart: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function fetchRanking(
  period: RankingPeriod,
): Promise<RankingResponse> {
  const response = await fetch(`${API_URL}/rankings/${period}?limit=50`);
  if (!response.ok) throw new Error('Ranking indisponível.');
  return response.json() as Promise<RankingResponse>;
}

export async function submitDailyRanking(input: {
  deviceKey: string;
  elapsedMs: number;
  nickname: string;
  playedOn: string;
  roundIndex: number;
}): Promise<void> {
  const response = await fetch(`${API_URL}/rankings/daily`, {
    body: JSON.stringify(input),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw new Error('Não foi possível salvar no ranking.');
}
