'use client';

import {
  type PrecisionLabel,
  calculateDifference,
  classifyPrecision,
  generateTargetMs,
} from '@exact-io/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

type GameState = 'idle' | 'target' | 'countdown' | 'playing' | 'result';

interface RoundResult {
  actualMs: number;
  differenceMs: number;
  precision: PrecisionLabel;
  signedDifferenceMs: number;
}

const COUNTDOWN_FROM = 3;
const TARGET_PREVIEW_MS = 2_500;

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
  const [gameState, setGameState] = useState<GameState>('idle');
  const [targetMs, setTargetMs] = useState(0);
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [result, setResult] = useState<RoundResult | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  const beginRound = useCallback(() => {
    setTargetMs(generateTargetMs());
    setResult(null);
    setCountdown(COUNTDOWN_FROM);
    stoppedRef.current = false;
    startedAtRef.current = null;
    setGameState('target');
  }, []);

  const stopRound = useCallback(() => {
    if (stoppedRef.current || startedAtRef.current === null) return;

    stoppedRef.current = true;
    const actualMs = performance.now() - startedAtRef.current;
    const signedDifferenceMs = actualMs - targetMs;
    const differenceMs = calculateDifference(targetMs, actualMs);

    setResult({
      actualMs,
      differenceMs,
      precision: classifyPrecision(differenceMs),
      signedDifferenceMs,
    });
    setGameState('result');
  }, [targetMs]);

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

    const timeout = window.setTimeout(() => {
      if (countdown > 1) {
        setCountdown((value) => value - 1);
        return;
      }

      startedAtRef.current = performance.now();
      setGameState('playing');
    }, 1_000);

    return () => window.clearTimeout(timeout);
  }, [countdown, gameState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      event.preventDefault();
      if (gameState === 'playing') stopRound();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, stopRound]);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(16,185,129,0.09),transparent_42%)]" />

      <section className="relative flex min-h-[640px] w-full max-w-xl flex-col rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:min-h-[680px] sm:p-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.35em] text-emerald-400">
              EXACT
            </p>
            <p className="mt-1 text-[10px] tracking-[0.22em] text-zinc-600">
              SINGLE PLAYER
            </p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold tracking-widest text-zinc-500">
            ROUND 1
          </span>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {gameState === 'idle' && (
            <>
              <p className="text-sm font-semibold tracking-[0.3em] text-emerald-400">
                FEEL THE TIME
              </p>
              <h1 className="mt-5 text-6xl font-black tracking-tighter text-white sm:text-8xl">
                EXACT
              </h1>
              <p className="mt-6 max-w-sm text-balance leading-7 text-zinc-400">
                Memorize o alvo. Quando o relógio desaparecer, pare no instante
                exato.
              </p>
              <button
                className="mt-12 w-full max-w-sm cursor-pointer rounded-2xl bg-emerald-400 px-8 py-5 text-lg font-black tracking-[0.2em] text-zinc-950 transition hover:bg-emerald-300 active:scale-[0.98]"
                onClick={beginRound}
                type="button"
              >
                INICIAR
              </button>
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
              <p
                key={countdown}
                className="countdown-pop mt-5 text-9xl font-black text-white"
              >
                {countdown}
              </p>
            </div>
          )}

          {gameState === 'playing' && (
            <div
              className="flex w-full flex-1 flex-col items-center justify-center"
              aria-live="polite"
            >
              <div className="mb-auto mt-auto">
                <span className="inline-flex items-center gap-3 text-sm font-bold tracking-[0.35em] text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />{' '}
                  AGORA
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
            <div className="w-full" aria-live="polite">
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
              <div className="mt-10 grid grid-cols-2 gap-3">
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
                onClick={beginRound}
                type="button"
              >
                JOGAR NOVAMENTE
              </button>
            </div>
          )}
        </div>

        <footer className="mt-8 text-center text-[10px] font-semibold tracking-[0.2em] text-zinc-700">
          {gameState === 'playing'
            ? 'TOQUE NO BOTÃO OU PRESSIONE SPACE'
            : 'PRECISÃO EM MILISSEGUNDOS'}
        </footer>
      </section>
    </main>
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
