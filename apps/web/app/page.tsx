'use client';

import {
  EMPTY_SOLO_RECORDS,
  type DailyResult,
  type PrecisionLabel,
  type SoloRecords,
  calculateDifference,
  calculateScore,
  classifyPrecision,
  generateDailyTargetMs,
  getSaoPauloDateKey,
  parseDailyResult,
  parseSoloRecords,
  summarizeSession,
  updateDailyResult,
  updateSoloRecords,
} from '@exact-io/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { playSound, type SoundCue } from './audio';
import { submitDailyRanking } from './ranking-client';
import { useRealtimeStatus } from './use-realtime-status';

type GameState =
  'idle' | 'target' | 'countdown' | 'playing' | 'result' | 'summary';

interface RoundResult {
  actualMs: number;
  differenceMs: number;
  precision: PrecisionLabel;
  score: number;
  signedDifferenceMs: number;
  targetMs: number;
}

const COUNTDOWN_FROM = 3;
const TARGET_PREVIEW_MS = 2_500;
const TOTAL_ROUNDS = 3;
const RECORDS_STORAGE_KEY = 'exact:solo-records:v2';
const SOUND_STORAGE_KEY = 'exact:sound-enabled:v1';
const DAILY_STORAGE_KEY = 'exact:daily-result:v1';
const DEVICE_KEY_STORAGE_KEY = 'exact:device-key:v1';
const NICKNAME_STORAGE_KEY = 'exact:nickname:v1';

const precisionStyles: Record<PrecisionLabel, string> = {
  PERFECT: 'text-emerald-300 drop-shadow-[0_0_24px_rgba(52,211,153,0.85)]',
  INSANE: 'text-cyan-300',
  GREAT: 'text-sky-300',
  GOOD: 'text-amber-300',
  OK: 'text-orange-300',
  MISS: 'text-rose-400',
};

function formatSeconds(milliseconds: number): string {
  const truncatedSeconds = Math.trunc(milliseconds / 10) / 100;
  return `${truncatedSeconds.toFixed(2)}s`;
}

function formatTarget(milliseconds: number): string {
  return formatSeconds(milliseconds);
}

export default function HomePage() {
  const realtimeStatus = useRealtimeStatus();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [targetMs, setTargetMs] = useState(0);
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [records, setRecords] = useState<SoloRecords>(EMPTY_SOLO_RECORDS);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null);
  const [dailyResultLoaded, setDailyResultLoaded] = useState(false);
  const [nickname, setNickname] = useState('');
  const [rankingStatus, setRankingStatus] = useState<
    'error' | 'idle' | 'saved' | 'sending'
  >('idle');
  const audioContextRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const sessionSavedRef = useRef(false);
  const nextRoundIndexRef = useRef(0);

  useEffect(() => {
    try {
      setRecords(
        parseSoloRecords(window.localStorage.getItem(RECORDS_STORAGE_KEY)),
      );
    } catch {
      setRecords(EMPTY_SOLO_RECORDS);
    }
  }, []);

  useEffect(() => {
    try {
      setNickname(window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? '');
    } catch {
      setNickname('');
    }
  }, []);

  useEffect(() => {
    try {
      const stored = parseDailyResult(
        window.localStorage.getItem(DAILY_STORAGE_KEY),
      );
      setDailyResult(stored?.date === getSaoPauloDateKey() ? stored : null);
    } catch {
      setDailyResult(null);
    } finally {
      setDailyResultLoaded(true);
    }
  }, []);

  useEffect(() => {
    try {
      setSoundEnabled(
        window.localStorage.getItem(SOUND_STORAGE_KEY) !== 'false',
      );
    } catch {
      setSoundEnabled(true);
    }
  }, []);

  const sound = useCallback(
    (cue: SoundCue) => {
      if (!soundEnabled) return;

      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      void context.resume().then(() => playSound(context, cue));
    },
    [soundEnabled],
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((enabled) => {
      const nextEnabled = !enabled;
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, String(nextEnabled));
      } catch {
        // Sound preference remains available for the current page session.
      }
      return nextEnabled;
    });
  }, []);

  const beginRound = useCallback(() => {
    setTargetMs(
      generateDailyTargetMs(getSaoPauloDateKey(), nextRoundIndexRef.current),
    );
    nextRoundIndexRef.current += 1;
    setResult(null);
    setCountdown(COUNTDOWN_FROM);
    stoppedRef.current = false;
    startedAtRef.current = null;
    setGameState('target');
  }, []);

  const beginSession = useCallback(() => {
    if (dailyResult) return;
    const normalizedNickname = nickname.trim();
    if (normalizedNickname.length < 2 || normalizedNickname.length > 16) return;
    try {
      window.localStorage.setItem(NICKNAME_STORAGE_KEY, normalizedNickname);
    } catch {
      // Nickname remains available for this page session.
    }
    setRankingStatus('idle');
    if (soundEnabled) {
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      void context.resume();
    }
    nextRoundIndexRef.current = 0;
    sessionSavedRef.current = false;
    setRoundResults([]);
    beginRound();
  }, [beginRound, dailyResult, nickname, soundEnabled]);

  const stopRound = useCallback(() => {
    if (stoppedRef.current || startedAtRef.current === null) return;

    stoppedRef.current = true;
    const actualMs = performance.now() - startedAtRef.current;
    const signedDifferenceMs = actualMs - targetMs;
    const differenceMs = calculateDifference(targetMs, actualMs);

    const roundResult: RoundResult = {
      actualMs,
      differenceMs,
      precision: classifyPrecision(differenceMs),
      score: calculateScore(differenceMs),
      signedDifferenceMs,
      targetMs,
    };

    setResult(roundResult);
    setRoundResults((results) => [...results, roundResult]);
    sound(roundResult.precision === 'PERFECT' ? 'perfect' : 'result');
    setGameState('result');
  }, [sound, targetMs]);

  const continueSession = useCallback(() => {
    if (roundResults.length >= TOTAL_ROUNDS) {
      if (sessionSavedRef.current) {
        setGameState('summary');
        return;
      }

      sessionSavedRef.current = true;
      const sessionSummary = summarizeSession(roundResults);
      const bestSessionRound = roundResults[sessionSummary.bestRoundIndex];
      const nextRecords = updateSoloRecords(records, {
        averageDifferenceMs: sessionSummary.averageDifferenceMs,
        bestScore: sessionSummary.bestScore,
        bestDifferenceMs: bestSessionRound.differenceMs,
      });
      const nextDailyResult = updateDailyResult(dailyResult, {
        bestDifferenceMs: bestSessionRound.differenceMs,
        bestScore: sessionSummary.bestScore,
        date: getSaoPauloDateKey(),
      });

      setRecords(nextRecords);
      setDailyResult(nextDailyResult);
      try {
        window.localStorage.setItem(
          RECORDS_STORAGE_KEY,
          JSON.stringify(nextRecords),
        );
        window.localStorage.setItem(
          DAILY_STORAGE_KEY,
          JSON.stringify(nextDailyResult),
        );
      } catch {
        // The current session still works when browser storage is unavailable.
      }
      const normalizedNickname = nickname.trim();
      if (normalizedNickname.length >= 2 && normalizedNickname.length <= 16) {
        setRankingStatus('sending');
        void submitDailyRanking({
          deviceKey: getOrCreateDeviceKey(),
          elapsedMs: bestSessionRound.actualMs,
          nickname: normalizedNickname,
          playedOn: getSaoPauloDateKey(),
          roundIndex: sessionSummary.bestRoundIndex,
        })
          .then(() => setRankingStatus('saved'))
          .catch(() => setRankingStatus('error'));
      }
      setGameState('summary');
      return;
    }

    beginRound();
  }, [beginRound, dailyResult, nickname, records, roundResults]);

  useEffect(() => {
    if (gameState !== 'target') return;
    const timeout = window.setTimeout(
      () => setGameState('countdown'),
      TARGET_PREVIEW_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'countdown') return;

    sound('countdown');

    const timeout = window.setTimeout(() => {
      if (countdown > 1) {
        setCountdown((value) => value - 1);
        return;
      }

      startedAtRef.current = performance.now();
      sound('go');
      setGameState('playing');
    }, 1_000);

    return () => window.clearTimeout(timeout);
  }, [countdown, gameState, sound]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      event.preventDefault();
      if (gameState === 'playing') stopRound();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, stopRound]);

  const completedRounds = roundResults.length;
  const currentRound =
    gameState === 'result'
      ? completedRounds
      : Math.min(completedRounds + 1, TOTAL_ROUNDS);
  const summary = summarizeSession(roundResults);
  const bestRound = roundResults[summary.bestRoundIndex];
  const worstRound = roundResults[summary.worstRoundIndex];

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(16,185,129,0.09),transparent_42%)]" />

      <section className="relative flex min-h-[640px] w-full max-w-xl flex-col rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:min-h-[680px] sm:p-10">
        <header className="flex items-center justify-between">
          <div>
            <Image
              alt="EXACT"
              className="h-auto w-24"
              height={477}
              priority
              src="/exact-logo-final.png"
              width={1281}
            />
            <p className="mt-1 text-[10px] tracking-[0.22em] text-zinc-600">
              DESAFIO DIÁRIO
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              aria-label={`Servidor ${realtimeStatus}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[9px] font-semibold tracking-widest text-zinc-500"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  realtimeStatus === 'online'
                    ? 'bg-emerald-400'
                    : realtimeStatus === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-zinc-600'
                }`}
              />
              {realtimeStatus === 'online'
                ? 'ONLINE'
                : realtimeStatus === 'connecting'
                  ? 'CONECTANDO'
                  : 'OFFLINE'}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold tracking-widest text-zinc-500">
              {gameState === 'summary'
                ? 'FINAL'
                : `RODADA ${currentRound}/${TOTAL_ROUNDS}`}
            </span>
            <button
              aria-label={soundEnabled ? 'Desativar sons' : 'Ativar sons'}
              aria-pressed={soundEnabled}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 text-sm text-zinc-500 transition hover:border-white/20 hover:text-zinc-200"
              onClick={toggleSound}
              title={soundEnabled ? 'Desativar sons' : 'Ativar sons'}
              type="button"
            >
              {soundEnabled ? '♪' : '×'}
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {gameState === 'idle' && (
            <>
              <h1 className="w-full max-w-md">
                <Image
                  alt="EXACT"
                  className="h-auto w-full"
                  height={477}
                  priority
                  src="/exact-logo-final.png"
                  width={1281}
                />
              </h1>
              {dailyResultLoaded && dailyResult ? (
                <div className="mt-8 w-full max-w-sm rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-6 py-6">
                  <p className="text-xs font-black tracking-[0.24em] text-emerald-300">
                    DESAFIO DE HOJE CONCLUÍDO
                  </p>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    Sua melhor tentativa já está no ranking. Um novo desafio
                    libera amanhã.
                  </p>
                  <p className="mt-4 font-mono text-3xl font-black text-white">
                    {dailyResult.bestScore.toLocaleString('pt-BR')} PT
                  </p>
                </div>
              ) : (
                <>
                  <input
                    aria-label="Seu nickname"
                    className="mt-8 w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center text-white outline-none transition placeholder:text-zinc-700 focus:border-emerald-400/50"
                    maxLength={16}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder="SEU NICKNAME"
                    value={nickname}
                  />
                  {records.gamesPlayed > 0 && (
                    <p className="mt-5 text-xs tracking-widest text-zinc-600">
                      RECORDE {records.highScore.toLocaleString('pt-BR')} ·{' '}
                      {records.gamesPlayed}{' '}
                      {records.gamesPlayed === 1 ? 'PARTIDA' : 'PARTIDAS'}
                    </p>
                  )}
                  <button
                    className="mt-4 w-full max-w-sm cursor-pointer rounded-2xl bg-emerald-400 px-8 py-5 text-lg font-black tracking-[0.2em] text-zinc-950 transition hover:bg-emerald-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={
                      !dailyResultLoaded ||
                      nickname.trim().length < 2 ||
                      nickname.trim().length > 16
                    }
                    onClick={beginSession}
                    type="button"
                  >
                    DESAFIO DIÁRIO
                  </button>
                </>
              )}
              <div className="mt-4 flex w-full max-w-sm flex-col gap-3">
                <Link
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-5 text-sm font-black tracking-[0.2em] text-white transition hover:border-emerald-400/30 hover:bg-white/[0.06]"
                  href="/room"
                >
                  MULTIPLAYER
                </Link>
                <Link
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-5 text-sm font-black tracking-[0.2em] text-white transition hover:border-emerald-400/30 hover:bg-white/[0.06]"
                  href="/ranking"
                >
                  RANKING
                </Link>
              </div>
            </>
          )}

          {gameState === 'target' && (
            <div aria-live="polite">
              <p className="text-xs font-bold tracking-[0.38em] text-zinc-500">
                SEU ALVO
              </p>
              <p className="mt-5 font-mono text-6xl font-black tracking-tight text-white sm:text-8xl">
                {formatTarget(targetMs)}
              </p>
              <p className="mt-8 text-sm text-zinc-500">Memorize este tempo</p>
            </div>
          )}

          {gameState === 'countdown' && (
            <div aria-live="assertive">
              <p className="text-xs font-bold tracking-[0.38em] text-zinc-500">
                PREPARE-SE
              </p>
              <CountdownRing key="solo-countdown" />
            </div>
          )}

          {gameState === 'playing' && (
            <div
              className="flex w-full flex-1 flex-col items-center justify-center"
              aria-live="polite"
            >
              <div className="mb-auto mt-auto">
                <span className="inline-flex items-center gap-3 text-sm font-bold tracking-[0.35em] text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> AGORA
                </span>
                <p className="mt-5 text-3xl font-black tracking-tight text-white">
                  Sinta o tempo.
                </p>
                <p className="mt-3 text-sm text-zinc-600">
                  Nenhuma pista. Só você.
                </p>
              </div>
              <button
                className="stop-button mt-12 w-full cursor-pointer rounded-3xl border border-rose-400/30 bg-rose-500 px-8 py-10 text-3xl font-black tracking-[0.18em] text-white shadow-[0_0_50px_rgba(244,63,94,0.18)] transition hover:bg-rose-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:py-12"
                disabled={stoppedRef.current}
                onClick={stopRound}
                type="button"
              >
                PARAR
              </button>
            </div>
          )}

          {gameState === 'result' && result && (
            <div
              className={`w-full ${result.precision === 'PERFECT' ? 'perfect-result' : ''}`}
              aria-live="polite"
            >
              <p className="text-xs font-bold tracking-[0.38em] text-zinc-500">
                DIFERENÇA
              </p>
              <p
                className={`mt-4 font-mono text-6xl font-black tracking-tight sm:text-8xl ${precisionStyles[result.precision]}`}
              >
                {formatSeconds(result.differenceMs)}
              </p>
              <p
                className={`mt-4 text-xl font-black tracking-[0.3em] ${precisionStyles[result.precision]}`}
              >
                {result.precision}
              </p>

              <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-5 py-5">
                <p className="text-[10px] font-bold tracking-[0.3em] text-emerald-500/70">
                  PONTUAÇÃO
                </p>
                <p className="mt-2 font-mono text-4xl font-black tracking-tight text-emerald-300">
                  {result.score.toLocaleString('pt-BR')}
                </p>
                <p className="mt-1 text-[10px] tracking-widest text-zinc-600">
                  DE 1.000 PONTOS
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <ResultMetric label="ALVO" value={formatTarget(targetMs)} />
                <ResultMetric
                  label="VOCÊ"
                  value={formatSeconds(result.actualMs)}
                />
              </div>
              <p className="mt-4 text-xs text-zinc-600">
                Você parou {result.signedDifferenceMs >= 0 ? 'depois' : 'antes'}{' '}
                do alvo.
              </p>
              <button
                className="mt-10 w-full cursor-pointer rounded-2xl bg-white px-8 py-5 text-sm font-black tracking-[0.2em] text-zinc-950 transition hover:bg-zinc-200 active:scale-[0.98]"
                onClick={continueSession}
                type="button"
              >
                {completedRounds >= TOTAL_ROUNDS
                  ? 'VER RESULTADO'
                  : 'PRÓXIMA RODADA'}
              </button>
            </div>
          )}

          {gameState === 'summary' && bestRound && worstRound && (
            <div className="w-full" aria-live="polite">
              <p className="text-xs font-bold tracking-[0.38em] text-emerald-400">
                PARTIDA CONCLUÍDA
              </p>
              <p className="mt-4 font-mono text-6xl font-black tracking-tight text-white sm:text-7xl">
                {summary.bestScore.toLocaleString('pt-BR')}
              </p>
              <p className="mt-2 text-[10px] tracking-[0.3em] text-zinc-600">
                MELHOR RESULTADO DE 3 · MÁXIMO 1.000
              </p>

              {dailyResult && (
                <div className="mt-6 flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-5 py-4 text-left">
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.25em] text-emerald-500/70">
                      RANKING DIÁRIO LOCAL
                    </p>
                    <p className="mt-1 text-sm font-bold text-zinc-300">
                      #1 VOCÊ
                    </p>
                  </div>
                  <p className="font-mono text-2xl font-black text-emerald-300">
                    {dailyResult.bestScore}
                  </p>
                </div>
              )}
              {rankingStatus !== 'idle' && (
                <p
                  className={`mt-4 text-[10px] font-bold tracking-widest ${rankingStatus === 'saved' ? 'text-emerald-400' : rankingStatus === 'error' ? 'text-amber-400' : 'text-zinc-500'}`}
                >
                  {rankingStatus === 'sending'
                    ? 'ENVIANDO PARA O RANKING…'
                    : rankingStatus === 'saved'
                      ? 'RESULTADO SALVO NO RANKING GLOBAL'
                      : 'RANKING GLOBAL INDISPONÍVEL · RESULTADO LOCAL SALVO'}
                </p>
              )}

              <div className="mt-8 grid grid-cols-2 gap-3">
                <ResultMetric
                  label="ERRO MÉDIO"
                  value={formatSeconds(summary.averageDifferenceMs)}
                />
                <ResultMetric
                  label="PERFECTS"
                  value={String(summary.perfects)}
                />
                <ResultMetric
                  label="MELHOR"
                  value={formatSeconds(bestRound.differenceMs)}
                />
                <ResultMetric
                  label="PIOR"
                  value={formatSeconds(worstRound.differenceMs)}
                />
              </div>

              <div className="mt-5 space-y-2">
                {roundResults.map((round, index) => (
                  <div
                    className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
                    key={`${round.targetMs}-${index}`}
                  >
                    <span className="text-[10px] font-bold tracking-widest text-zinc-600">
                      R{index + 1}
                    </span>
                    <span
                      className={`text-xs font-bold ${precisionStyles[round.precision]}`}
                    >
                      {round.precision}
                    </span>
                    <span className="font-mono text-sm text-zinc-400">
                      {formatSeconds(round.differenceMs)}
                    </span>
                    <span className="w-12 text-right font-mono text-sm font-bold text-zinc-200">
                      {round.score}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-7 border-t border-white/[0.07] pt-6">
                <p className="text-[10px] font-bold tracking-[0.3em] text-zinc-600">
                  RECORDES LOCAIS
                </p>
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-left">
                  <RecordMetric
                    label="MAIOR SCORE"
                    value={records.highScore.toLocaleString('pt-BR')}
                  />
                  <RecordMetric
                    label="PARTIDAS"
                    value={String(records.gamesPlayed)}
                  />
                  <RecordMetric
                    label="MENOR ERRO"
                    value={formatOptionalSeconds(records.bestErrorMs)}
                  />
                  <RecordMetric
                    label="MELHOR MÉDIA"
                    value={formatOptionalSeconds(records.bestAverageMs)}
                  />
                </div>
              </div>

              <p className="mt-8 rounded-2xl border border-white/10 px-5 py-4 text-xs font-bold tracking-[0.16em] text-zinc-500">
                DESAFIO DIÁRIO ENCERRADO · VOLTE AMANHÃ
              </p>
              <Link
                className="mt-6 inline-block text-xs font-bold tracking-[0.2em] text-zinc-500 transition hover:text-emerald-400"
                href="/ranking"
              >
                VER RANKING GLOBAL
              </Link>
            </div>
          )}
        </div>

        {gameState === 'playing' && (
          <footer className="mt-8 text-center text-[10px] font-semibold tracking-[0.2em] text-zinc-700">
            TOQUE NO BOTÃO OU PRESSIONE SPACE
          </footer>
        )}
      </section>
    </main>
  );
}

function CountdownRing() {
  return (
    <div className="relative mx-auto mt-7 h-32 w-32" aria-hidden="true">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle
          className="fill-none stroke-white/10"
          cx="60"
          cy="60"
          r="52"
          strokeWidth="8"
        />
        <circle
          className="countdown-ring fill-none stroke-emerald-400"
          cx="60"
          cy="60"
          r="52"
          strokeLinecap="round"
          strokeWidth="8"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-white">
        GO
      </span>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-bold tracking-[0.25em] text-zinc-600">
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-bold text-zinc-200">{value}</p>
    </div>
  );
}

function RecordMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold tracking-[0.2em] text-zinc-700">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-bold text-zinc-300">{value}</p>
    </div>
  );
}

function formatOptionalSeconds(milliseconds: number | null): string {
  return milliseconds === null ? '—' : formatSeconds(milliseconds);
}

function getOrCreateDeviceKey(): string {
  try {
    const stored = window.localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
    if (stored && stored.length >= 16) return stored;
    const created = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY_STORAGE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}
