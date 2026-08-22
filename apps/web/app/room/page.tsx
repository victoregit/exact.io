'use client';

import {
  SocketEvents,
  type ClientToServerEvents,
  type RoomMode,
  type RoomSnapshot,
  type ServerToClientEvents,
} from '@exact-io/shared';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

const NICKNAME_STORAGE_KEY = 'exact:nickname:v1';

export default function RoomPage() {
  const [connected, setConnected] = useState(false);
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<RoomMode>('points');
  const [rounds, setRounds] = useState<5 | 10>(5);
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [clockNow, setClockNow] = useState(() => Date.now());
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);

  useEffect(() => {
    setNickname(window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? '');
    setCode(
      new URLSearchParams(window.location.search).get('code')?.toUpperCase() ??
        '',
    );

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
    );
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on(SocketEvents.ROOM_STATE, setRoom);

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (room?.match?.phase !== 'countdown') return;
    setClockNow(Date.now());
    const interval = window.setInterval(() => setClockNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [room?.match?.countdownEndsAt, room?.match?.phase]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      const activePlayer = room?.players.find(
        (player) => player.id === room.match?.activePlayerId,
      );
      const isMyTurn =
        activePlayer?.nickname.toLocaleLowerCase() ===
        nickname.trim().toLocaleLowerCase();
      if (!isMyTurn || !room?.match) return;

      if (room.match.phase === 'ready') {
        event.preventDefault();
        runTurnAction(SocketEvents.ROUND_START);
      } else if (room.match.phase === 'timing') {
        event.preventDefault();
        runTurnAction(SocketEvents.ROUND_STOP);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nickname, room]);

  function rememberNickname() {
    try {
      window.localStorage.setItem(NICKNAME_STORAGE_KEY, nickname.trim());
    } catch {
      // Nickname remains available for the current page session.
    }
  }

  function createRoom() {
    setError('');
    setNotice('');
    socketRef.current?.emit(
      SocketEvents.ROOM_CREATE,
      { maxPlayers, mode, nickname, rounds },
      (response) => {
        if (!response.ok) {
          setError(response.message);
          return;
        }
        rememberNickname();
        setRoom(response.room);
        window.history.replaceState(
          null,
          '',
          `/room?code=${response.room.code}`,
        );
      },
    );
  }

  function selectMode(nextMode: RoomMode) {
    setMode(nextMode);
    if (nextMode === 'duos') setMaxPlayers(4);
  }

  function joinRoom() {
    setError('');
    setNotice('');
    socketRef.current?.emit(
      SocketEvents.ROOM_JOIN,
      { code, nickname },
      (response) => {
        if (!response.ok) {
          setError(response.message);
          return;
        }
        rememberNickname();
        setRoom(response.room);
        window.history.replaceState(
          null,
          '',
          `/room?code=${response.room.code}`,
        );
      },
    );
  }

  function leaveRoom() {
    socketRef.current?.emit(SocketEvents.ROOM_LEAVE, () => {
      setRoom(null);
      setNotice('Você saiu da sala.');
      window.history.replaceState(null, '', '/room');
    });
  }

  function startGame() {
    setError('');
    setNotice('');
    socketRef.current?.emit(SocketEvents.GAME_START, (response) => {
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setRoom(response.room);
    });
  }

  function setReady(ready: boolean) {
    setError('');
    socketRef.current?.emit(SocketEvents.ROOM_READY, ready, (response) => {
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setRoom(response.room);
    });
  }

  function setAutoAdvance(enabled: boolean) {
    setError('');
    socketRef.current?.emit(
      SocketEvents.ROOM_AUTO_ADVANCE,
      enabled,
      (response) => {
        if (!response.ok) {
          setError(response.message);
          return;
        }
        setRoom(response.room);
      },
    );
  }

  function runTurnAction(
    event: 'round:next' | 'round:start' | 'round:stop' | 'round:verify',
  ) {
    setError('');
    socketRef.current?.emit(event, (response) => {
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setRoom(response.room);
    });
  }

  async function copyInvite() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/room?code=${room.code}`,
      );
      setNotice('Link de convite copiado.');
    } catch {
      setNotice(`Compartilhe o código ${room.code}.`);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-8">
      <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6 shadow-2xl sm:p-10">
        <header className="flex items-center justify-between">
          <Link
            aria-label="Voltar para o início"
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black tracking-[0.18em] text-zinc-400 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-300 active:scale-95"
            href="/"
            title="Voltar para o início"
          >
            <span className="text-base leading-none transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            <Image
              alt="EXACT"
              className="h-auto w-16"
              height={477}
              src="/exact-logo-final.png"
              width={1281}
            />
          </Link>
          <span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-widest text-zinc-500">
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-zinc-700'}`}
            />
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </header>

        {!room ? (
          <div className="mt-10">
            <p className="text-xs font-bold tracking-[0.3em] text-zinc-500">
              MULTIPLAYER
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
              Jogue com amigos.
            </h1>

            <label className="mt-8 block text-[10px] font-bold tracking-widest text-zinc-500">
              NICKNAME
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-base text-white outline-none transition focus:border-emerald-400/50"
                maxLength={16}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="Seu nome"
                value={nickname}
              />
            </label>

            <div className="mt-6 grid grid-cols-[1fr_auto] gap-3">
              <input
                aria-label="Código da sala"
                className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 font-mono uppercase tracking-[0.25em] text-white outline-none focus:border-emerald-400/50"
                maxLength={5}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="CÓDIGO"
                value={code}
              />
              <button
                className="cursor-pointer rounded-xl border border-white/10 px-5 text-xs font-black tracking-widest text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!connected || code.length !== 5}
                onClick={joinRoom}
                type="button"
              >
                ENTRAR
              </button>
            </div>

            <div className="my-8 flex items-center gap-4 text-[10px] text-zinc-700">
              <span className="h-px flex-1 bg-white/10" /> OU CRIE UMA SALA{' '}
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <OptionButton
                active={mode === 'points'}
                label="PONTOS"
                onClick={() => selectMode('points')}
              />
              <OptionButton
                active={mode === 'elimination'}
                label="ELIMINATÓRIO"
                onClick={() => selectMode('elimination')}
              />
              <OptionButton
                active={mode === 'duos'}
                label="DUPLAS"
                onClick={() => selectMode('duos')}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-[10px] font-bold tracking-widest text-zinc-500">
                JOGADORES
                <select
                  className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-white"
                  disabled={mode === 'duos'}
                  onChange={(event) =>
                    setMaxPlayers(Number(event.target.value))
                  }
                  value={maxPlayers}
                >
                  {[2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] font-bold tracking-widest text-zinc-500">
                RODADAS
                <select
                  className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-white disabled:opacity-40"
                  disabled={mode === 'elimination'}
                  onChange={(event) =>
                    setRounds(Number(event.target.value) as 5 | 10)
                  }
                  value={rounds}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </label>
            </div>

            {error && (
              <p className="mt-5 text-sm text-rose-400" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="mt-5 text-sm text-emerald-400">{notice}</p>
            )}

            <button
              className="mt-7 w-full cursor-pointer rounded-2xl bg-emerald-400 px-6 py-5 text-sm font-black tracking-[0.2em] text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!connected}
              onClick={createRoom}
              type="button"
            >
              CRIAR SALA
            </button>
          </div>
        ) : (
          <div className="mt-10 text-center">
            <p className="text-[10px] font-bold tracking-[0.3em] text-zinc-500">
              CÓDIGO DA SALA
            </p>
            <p className="mt-3 font-mono text-5xl font-black tracking-[0.22em] text-white">
              {room.code}
            </p>
            <button
              className="mt-4 cursor-pointer text-xs font-bold tracking-widest text-emerald-400"
              onClick={copyInvite}
              type="button"
            >
              COPIAR CONVITE
            </button>

            <div className="mt-8 flex items-center justify-between text-[10px] font-bold tracking-widest text-zinc-600">
              <span>
                {room.mode === 'points'
                  ? `${room.rounds} RODADAS`
                  : room.mode === 'duos'
                    ? `DUPLAS · ${room.rounds} RODADAS`
                    : 'ELIMINATÓRIO'}
              </span>
              <span>
                {room.players.length}/{room.maxPlayers} JOGADORES
              </span>
            </div>
            {!room.match && (
              <div className="mt-3 space-y-2">
                {room.players.map((player) => (
                <div
                  className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4"
                  key={player.id}
                >
                  <span className="font-mono text-xs text-zinc-600">
                    {player.slot ?? `#${player.order}`}
                  </span>
                  <span className="font-bold text-white">
                    {player.nickname}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {[
                      player.isHost ? 'HOST' : null,
                      room.match ? `${player.score} PT` : null,
                      player.team ? `DUPLA ${player.team}` : null,
                      player.team ? `T${player.turnOrder}` : null,
                      !player.team &&
                      room.mode === 'elimination' &&
                      player.shieldActive
                        ? '🛡️'
                        : null,
                      !player.isHost
                        ? player.isReady
                          ? 'READY'
                          : 'AGUARDANDO'
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                ))}
              </div>
            )}

            {notice && (
              <p className="mt-5 text-sm text-emerald-400">{notice}</p>
            )}
            {room.match ? (
              <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-6">
                <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {room.players.map((player) => {
                    const isActive =
                      player.id === room.match?.activePlayerId &&
                      room.match.phase !== 'result';
                    return (
                      <div
                        className={`min-w-0 rounded-xl border px-2 py-3 transition ${
                          isActive
                            ? 'border-emerald-400/60 bg-emerald-400/10 shadow-[0_0_18px_rgba(52,211,153,0.12)]'
                            : 'border-white/[0.08] bg-black/20'
                        }`}
                        key={player.id}
                      >
                        <p className="text-[9px] font-black tracking-widest text-zinc-600">
                          {player.slot ?? `#${player.order}`}
                          {player.isHost ? ' · HOST' : ''}
                        </p>
                        <p className="mt-1 truncate text-xs font-black text-white">
                          {player.nickname}
                        </p>
                        <p
                          className={`mt-1 font-mono text-[10px] font-bold ${isActive ? 'text-emerald-300' : 'text-zinc-500'}`}
                        >
                          {isActive ? 'SUA VEZ' : `${player.score} PT`}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {room.mode === 'duos' && (
                  <div className="mb-6 grid grid-cols-2 gap-3">
                    {(['AB', 'CD'] as const).map((team) => (
                      <div
                        className="rounded-xl border border-white/10 bg-black/20 p-3"
                        key={team}
                      >
                        <p className="text-[10px] font-bold tracking-widest text-zinc-500">
                          DUPLA {team}
                        </p>
                        <p className="mt-1 font-mono text-2xl font-black text-white">
                          {room.players
                            .filter((player) => player.team === team)
                            .reduce((total, player) => total + player.score, 0)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] font-bold tracking-[0.3em] text-emerald-400">
                  RODADA {room.match.currentRound}/{room.match.totalRounds}
                </p>
                <p className="mt-3 font-mono text-5xl font-black text-white">
                  {(room.match.targetMs / 1000).toFixed(2)}s
                </p>
                <p className="mt-4 text-sm text-zinc-400">
                  VEZ DE{' '}
                  <strong className="text-white">
                    {room.players.find(
                      (player) => player.id === room.match?.activePlayerId,
                    )?.nickname ?? 'JOGADOR'}
                  </strong>
                </p>
                <p className="mt-2 text-xs font-bold tracking-widest text-zinc-600">
                  {room.match.attempts.length}/{room.players.length} JOGARAM
                </p>
                <p className="mt-3 text-xs text-zinc-600">
                  A rodada permanece aberta até todos jogarem ou até{' '}
                  {((room.match.targetMs * 2) / 1000).toFixed(2)}s.
                </p>
                {(room.match.phase === 'ready' ||
                  room.match.phase === 'timing') &&
                  room.players
                    .find((player) => player.id === room.match?.activePlayerId)
                    ?.nickname.toLocaleLowerCase() ===
                    nickname.trim().toLocaleLowerCase() && (
                    <button
                      className={`mt-6 w-full cursor-pointer rounded-2xl px-6 py-5 text-sm font-black tracking-[0.2em] transition ${
                        room.match.phase === 'timing'
                          ? 'bg-rose-500 text-white hover:bg-rose-400'
                          : 'bg-emerald-400 text-zinc-950 hover:bg-emerald-300'
                      }`}
                      onClick={() =>
                        runTurnAction(
                          room.match?.phase === 'timing'
                            ? SocketEvents.ROUND_STOP
                            : SocketEvents.ROUND_START,
                        )
                      }
                      type="button"
                    >
                      {room.match.phase === 'timing' ? 'PARAR' : 'INICIAR'}
                    </button>
                  )}
                {(room.match.phase === 'ready' ||
                  room.match.phase === 'timing') && (
                  <p className="mt-3 text-[9px] font-bold tracking-[0.18em] text-zinc-600">
                    USE O BOTÃO OU PRESSIONE SPACE
                  </p>
                )}
                {room.match.phase === 'countdown' && (
                  <div className="mt-6 rounded-2xl bg-white/[0.04] py-6">
                    <p className="text-[10px] font-bold tracking-[0.3em] text-zinc-500">
                      PREPARE-SE
                    </p>
                    <RoomCountdownRing
                      endsAt={room.match.countdownEndsAt ?? clockNow}
                      now={clockNow}
                    />
                  </div>
                )}
                {room.match.phase === 'timing' && (
                  <p className="mt-5 animate-pulse text-xs font-bold tracking-widest text-rose-400">
                    CRONÔMETRO OCULTO EM ANDAMENTO
                  </p>
                )}
                {room.match.phase === 'verification' && (
                  <>
                    <p className="mt-5 text-xs font-bold tracking-widest text-emerald-400">
                      TODOS JOGARAM · {room.match.verifiedPlayerIds.length}/
                      {room.players.length} VERIFICARAM
                    </p>
                    {!room.match.verifiedPlayerIds.includes(
                      room.players.find(
                        (player) =>
                          player.nickname.toLocaleLowerCase() ===
                          nickname.trim().toLocaleLowerCase(),
                      )?.id ?? '',
                    ) && (
                      <button
                        className="mt-6 w-full cursor-pointer rounded-2xl border border-emerald-400/50 bg-emerald-400/10 px-6 py-5 text-sm font-black tracking-[0.15em] text-emerald-300 transition hover:bg-emerald-400/20"
                        onClick={() => runTurnAction(SocketEvents.ROUND_VERIFY)}
                        type="button"
                      >
                        VERIFICAR TEMPO
                      </button>
                    )}
                  </>
                )}
                {room.match.phase === 'result' && (
                  <div className="mt-6 border-t border-white/10 pt-5">
                    {room.match.championId && (
                      <p className="mb-4 text-sm font-black tracking-widest text-amber-300">
                        CAMPEÃO:{' '}
                        {room.mode === 'duos'
                          ? `DUPLA ${room.match.championId}`
                          : (room.players.find(
                              (player) => player.id === room.match?.championId,
                            )?.nickname ?? 'JOGADOR')}
                      </p>
                    )}
                    <p className="text-xs font-bold tracking-widest text-emerald-400">
                      {room.match.winnerIds.length === 1
                        ? `${room.players.find((player) => player.id === room.match?.winnerIds[0])?.nickname ?? 'JOGADOR'} VENCEU A RODADA`
                        : 'EMPATE NA RODADA'}
                    </p>
                    <div className="mt-4 space-y-2 text-left text-xs text-zinc-400">
                      {room.match.attempts.map((attempt) => (
                        <p key={attempt.playerId}>
                          {room.players.find(
                            (player) => player.id === attempt.playerId,
                          )?.nickname ?? 'Jogador'}{' '}
                          · {(attempt.elapsedMs / 1000).toFixed(2)}s
                        </p>
                      ))}
                    </div>
                    {room.status !== 'finished' &&
                      (room.autoAdvance ? (
                        <p className="mt-5 text-[10px] font-bold tracking-widest text-emerald-400">
                          INÍCIO AUTOMÁTICO · PRÓXIMA RODADA EM INSTANTES…
                        </p>
                      ) : room.players.find(
                          (player) =>
                            player.nickname.toLocaleLowerCase() ===
                            nickname.trim().toLocaleLowerCase(),
                        )?.isHost ? (
                        <div className="mt-6 grid grid-cols-2 gap-3">
                          <button
                            className="cursor-pointer rounded-2xl bg-emerald-400 px-3 py-4 text-[10px] font-black tracking-widest text-zinc-950 transition hover:bg-emerald-300"
                            onClick={() =>
                              runTurnAction(SocketEvents.ROUND_NEXT)
                            }
                            type="button"
                          >
                            PRÓXIMA RODADA
                          </button>
                          <button
                            className="cursor-pointer rounded-2xl border border-emerald-400/40 px-3 py-4 text-[10px] font-black tracking-widest text-emerald-300 transition hover:bg-emerald-400/10"
                            onClick={() => setAutoAdvance(true)}
                            type="button"
                          >
                            INÍCIO AUTOMÁTICO
                          </button>
                        </div>
                      ) : (
                        <p className="mt-5 text-[10px] font-bold tracking-widest text-zinc-500">
                          AGUARDANDO O HOST…
                        </p>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className="mt-8 text-sm text-zinc-600">
                  Aguardando jogadores. O host inicia quando todos estiverem
                  prontos.
                </p>
                {room.players.find(
                  (player) =>
                    player.nickname.toLocaleLowerCase() ===
                    nickname.trim().toLocaleLowerCase(),
                )?.isHost ? (
                  <button
                    className="mt-6 w-full cursor-pointer rounded-2xl bg-emerald-400 px-6 py-4 text-xs font-black tracking-[0.2em] text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={
                      room.players.length < 2 ||
                      (room.mode === 'duos' && room.players.length !== 4) ||
                      room.players.some(
                        (player) => !player.isHost && !player.isReady,
                      )
                    }
                    onClick={startGame}
                    type="button"
                  >
                    INICIAR PARTIDA
                  </button>
                ) : (
                  <button
                    className={`mt-6 w-full cursor-pointer rounded-2xl border px-6 py-4 text-xs font-black tracking-[0.2em] transition ${
                      room.players.find(
                        (player) =>
                          player.nickname.toLocaleLowerCase() ===
                          nickname.trim().toLocaleLowerCase(),
                      )?.isReady
                        ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300'
                        : 'border-white/10 text-white hover:bg-white/5'
                    }`}
                    onClick={() =>
                      setReady(
                        !room.players.find(
                          (player) =>
                            player.nickname.toLocaleLowerCase() ===
                            nickname.trim().toLocaleLowerCase(),
                        )?.isReady,
                      )
                    }
                    type="button"
                  >
                    {room.players.find(
                      (player) =>
                        player.nickname.toLocaleLowerCase() ===
                        nickname.trim().toLocaleLowerCase(),
                    )?.isReady
                      ? 'READY ✓'
                      : 'MARCAR READY'}
                  </button>
                )}
              </>
            )}
            {error && <p className="mt-5 text-sm text-rose-400">{error}</p>}
            <button
              className="mt-7 cursor-pointer text-xs font-bold tracking-widest text-rose-400"
              onClick={leaveRoom}
              type="button"
            >
              SAIR DA SALA
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function RoomCountdownRing({ endsAt, now }: { endsAt: number; now: number }) {
  const circumference = 327;
  const progress = Math.min(1, Math.max(0, 1 - (endsAt - now) / 3_000));

  return (
    <div className="relative mx-auto mt-5 h-28 w-28" aria-hidden="true">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle
          className="fill-none stroke-white/10"
          cx="60"
          cy="60"
          r="52"
          strokeWidth="8"
        />
        <circle
          className="fill-none stroke-emerald-400 transition-[stroke-dashoffset] duration-100 ease-linear"
          cx="60"
          cy="60"
          r="52"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          strokeWidth="8"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-black tracking-[0.18em] text-white">
        READY
      </span>
    </div>
  );
}

function OptionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`min-w-0 cursor-pointer overflow-hidden rounded-xl border px-1 py-4 text-[8px] font-black tracking-[0.04em] transition min-[390px]:text-[9px] min-[390px]:tracking-[0.08em] sm:px-3 sm:text-xs sm:tracking-widest ${active ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300' : 'border-white/10 text-zinc-500 hover:bg-white/5'}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
