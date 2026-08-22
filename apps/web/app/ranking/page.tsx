'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  fetchRanking,
  type RankingEntry,
  type RankingPeriod,
} from '../ranking-client';

const periods: { label: string; value: RankingPeriod }[] = [
  { label: 'DIÁRIO', value: 'daily' },
  { label: 'SEMANAL', value: 'weekly' },
  { label: 'MENSAL', value: 'monthly' },
];

export default function RankingPage() {
  const [period, setPeriod] = useState<RankingPeriod>('daily');
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [periodStart, setPeriodStart] = useState('');
  const [status, setStatus] = useState<'error' | 'loading' | 'ready'>(
    'loading',
  );

  useEffect(() => {
    let active = true;
    setStatus('loading');
    void fetchRanking(period)
      .then((response) => {
        if (!active) return;
        setEntries(response.entries);
        setPeriodStart(response.periodStart);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [period]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-8">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6 shadow-2xl sm:p-10">
        <header className="flex items-center justify-between">
          <Link
            className="text-xs font-bold tracking-[0.35em] text-emerald-400"
            href="/"
          >
            EXACT
          </Link>
          <span className="text-[10px] font-bold tracking-[0.3em] text-zinc-600">
            RANKING GLOBAL
          </span>
        </header>

        <div className="mt-10 grid grid-cols-3 gap-2">
          {periods.map((item) => (
            <button
              className={`cursor-pointer rounded-xl border px-2 py-4 text-xs font-black tracking-widest transition ${
                period === item.value
                  ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 text-zinc-600 hover:bg-white/5'
              }`}
              key={item.value}
              onClick={() => setPeriod(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="mt-5 text-center text-[10px] font-bold tracking-widest text-zinc-600">
          {periodStart ? `PERÍODO INICIADO EM ${formatDate(periodStart)}` : ' '}
        </p>

        <div className="mt-5 min-h-72">
          {status === 'loading' && (
            <p className="py-20 text-center text-sm text-zinc-600">
              CARREGANDO…
            </p>
          )}
          {status === 'error' && (
            <div className="py-16 text-center">
              <p className="text-sm font-bold text-zinc-400">
                RANKING INDISPONÍVEL
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                Configure o Supabase para ativar os resultados globais.
              </p>
            </div>
          )}
          {status === 'ready' && entries.length === 0 && (
            <p className="py-20 text-center text-sm text-zinc-600">
              AINDA NÃO HÁ RESULTADOS
            </p>
          )}
          {status === 'ready' && entries.length > 0 && (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  className="grid grid-cols-[3rem_1fr_auto] items-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4"
                  key={`${entry.position}-${entry.nickname}`}
                >
                  <span className="font-mono text-lg font-black text-emerald-400">
                    #{entry.position}
                  </span>
                  <div>
                    <p className="font-bold text-white">{entry.nickname}</p>
                    <p className="mt-1 text-[9px] tracking-widest text-zinc-600">
                      {entry.daysPlayed}{' '}
                      {entry.daysPlayed === 1 ? 'DIA' : 'DIAS'} · ERRO{' '}
                      {formatDifference(entry.bestDifferenceMs)}
                    </p>
                  </div>
                  <span className="font-mono text-xl font-black text-zinc-200">
                    {entry.totalScore.toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function formatDifference(milliseconds: number): string {
  return `${(Math.trunc(milliseconds / 10) / 100).toFixed(2)}s`;
}
