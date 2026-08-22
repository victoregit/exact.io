import { randomUUID } from 'node:crypto';

import type {
  CreateRoomPayload,
  JoinRoomPayload,
  RoomMatchSnapshot,
  RoomPlayer,
  RoomSnapshot,
} from '@exact-io/shared';
import {
  generateTargetMs,
  resolveChampionship,
  resolveMultiplayerRound,
} from '@exact-io/shared';

interface InternalPlayer extends RoomPlayer {
  socketId: string;
  token: string;
}

interface InternalMatch extends RoomMatchSnapshot {
  accumulatedMs: number;
  turnStartedAtMs: number | null;
}

interface InternalRoom extends Omit<RoomSnapshot, 'match' | 'players'> {
  match: InternalMatch | null;
  players: InternalPlayer[];
}

export class RoomError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class RoomManager {
  private readonly rooms = new Map<string, InternalRoom>();
  private readonly roomBySocket = new Map<string, string>();

  constructor(
    private readonly createCode: () => string = generateRoomCode,
    private readonly createTarget: () => number = generateTargetMs,
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random,
  ) {}

  create(payload: CreateRoomPayload, socketId: string) {
    this.assertSocketAvailable(socketId);
    const nickname = normalizeNickname(payload.nickname);
    if (!['points', 'elimination', 'duos'].includes(payload.mode)) {
      throw new RoomError('INVALID_MODE', 'Modo de jogo inválido.');
    }
    if (
      !Number.isInteger(payload.maxPlayers) ||
      payload.maxPlayers < 2 ||
      payload.maxPlayers > 5
    ) {
      throw new RoomError(
        'INVALID_CAPACITY',
        'A sala deve aceitar entre 2 e 5 jogadores.',
      );
    }
    if (payload.mode === 'duos' && payload.maxPlayers !== 4) {
      throw new RoomError(
        'INVALID_CAPACITY',
        'O modo Duplas precisa de exatamente 4 vagas.',
      );
    }
    if (payload.rounds !== 5 && payload.rounds !== 10) {
      throw new RoomError(
        'INVALID_ROUNDS',
        'Escolha uma partida de 5 ou 10 rodadas.',
      );
    }

    const code = this.createUniqueCode();
    const player = createPlayer(
      nickname,
      socketId,
      true,
      1,
      playerRoleFor(payload.mode, 1),
    );
    const room: InternalRoom = {
      autoAdvance: false,
      code,
      match: null,
      maxPlayers: payload.maxPlayers,
      mode: payload.mode,
      players: [player],
      rounds: payload.rounds,
      status: 'waiting',
    };

    this.rooms.set(code, room);
    this.roomBySocket.set(socketId, code);
    return { playerToken: player.token, room: toSnapshot(room) };
  }

  join(payload: JoinRoomPayload, socketId: string) {
    this.assertSocketAvailable(socketId);
    const code = payload.code.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Sala não encontrada.');
    if (room.status !== 'waiting') {
      throw new RoomError(
        'ROOM_IN_PROGRESS',
        'A partida desta sala já começou.',
      );
    }
    if (room.players.length >= room.maxPlayers) {
      throw new RoomError('ROOM_FULL', 'Esta sala está cheia.');
    }

    const nickname = normalizeNickname(payload.nickname);
    if (
      room.players.some(
        (player) => player.nickname.toLowerCase() === nickname.toLowerCase(),
      )
    ) {
      throw new RoomError(
        'NICKNAME_TAKEN',
        'Este nickname já está sendo usado na sala.',
      );
    }

    const order = room.players.length + 1;
    const player = createPlayer(
      nickname,
      socketId,
      false,
      order,
      playerRoleFor(room.mode, order),
    );
    room.players.push(player);
    this.roomBySocket.set(socketId, code);
    return { playerToken: player.token, room: toSnapshot(room) };
  }

  leave(socketId: string): { code: string; room: RoomSnapshot | null } | null {
    const code = this.roomBySocket.get(socketId);
    if (!code) return null;
    const room = this.rooms.get(code);
    this.roomBySocket.delete(socketId);
    if (!room) return null;

    room.players = room.players.filter(
      (player) => player.socketId !== socketId,
    );
    if (room.players.length === 0) {
      this.rooms.delete(code);
      return { code, room: null };
    }

    room.players.forEach((player, index) => {
      player.order = index + 1;
      player.isHost = index === 0;
      Object.assign(player, playerRoleFor(room.mode, player.order));
    });
    return { code, room: toSnapshot(room) };
  }

  getRoomForSocket(socketId: string): RoomSnapshot | null {
    const code = this.roomBySocket.get(socketId);
    const room = code ? this.rooms.get(code) : undefined;
    return room ? toSnapshot(room) : null;
  }

  setReady(socketId: string, ready: boolean): RoomSnapshot {
    const code = this.roomBySocket.get(socketId);
    const room = code ? this.rooms.get(code) : undefined;
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Sala não encontrada.');
    if (room.status !== 'waiting') {
      throw new RoomError('GAME_ALREADY_STARTED', 'A partida já começou.');
    }
    const player = room.players.find(
      (candidate) => candidate.socketId === socketId,
    );
    if (!player)
      throw new RoomError('PLAYER_NOT_FOUND', 'Jogador não encontrado.');
    if (player.isHost) {
      throw new RoomError('HOST_DOES_NOT_READY', 'O host inicia a partida.');
    }
    player.isReady = ready;
    return toSnapshot(room);
  }

  setAutoAdvance(socketId: string, enabled: boolean): RoomSnapshot {
    const code = this.roomBySocket.get(socketId);
    const room = code ? this.rooms.get(code) : undefined;
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Sala não encontrada.');
    const player = room.players.find(
      (candidate) => candidate.socketId === socketId,
    );
    if (!player?.isHost) {
      throw new RoomError(
        'HOST_ONLY',
        'Somente o host pode alterar o início automático.',
      );
    }
    room.autoAdvance = enabled;
    return toSnapshot(room);
  }

  start(socketId: string): RoomSnapshot {
    const code = this.roomBySocket.get(socketId);
    const room = code ? this.rooms.get(code) : undefined;
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Sala não encontrada.');

    const player = room.players.find(
      (candidate) => candidate.socketId === socketId,
    );
    if (!player?.isHost) {
      throw new RoomError(
        'HOST_ONLY',
        'Somente o host pode iniciar a partida.',
      );
    }
    if (room.status !== 'waiting') {
      throw new RoomError('GAME_ALREADY_STARTED', 'A partida já começou.');
    }
    if (room.players.length < 2) {
      throw new RoomError(
        'NOT_ENOUGH_PLAYERS',
        'Aguarde pelo menos dois jogadores.',
      );
    }
    if (room.mode === 'duos' && room.players.length !== 4) {
      throw new RoomError(
        'NOT_ENOUGH_PLAYERS',
        'O modo Duplas precisa dos quatro jogadores.',
      );
    }
    if (
      room.players.some((candidate) => !candidate.isHost && !candidate.isReady)
    ) {
      throw new RoomError(
        'PLAYERS_NOT_READY',
        'Aguarde todos os jogadores marcarem READY.',
      );
    }

    if (room.mode === 'elimination') this.shuffleActiveTurnOrder(room);
    const firstPlayer = room.players
      .filter((candidate) => !candidate.isEliminated)
      .sort(
      (left, right) => left.turnOrder - right.turnOrder,
      )[0];
    room.match = {
      activePlayerId: firstPlayer.id,
      accumulatedMs: 0,
      attempts: [],
      challengedByIds: [],
      championId: null,
      countdownEndsAt: room.mode === 'points' ? this.now() + 3_000 : null,
      currentRound: 1,
      isTiebreak: false,
      loserId: null,
      phase: room.mode === 'points' ? 'countdown' : 'ready',
      previousPlayerId: null,
      resolution: null,
      targetMs: this.targetForMode(room.mode),
      totalRounds: room.rounds,
      turnStartedAtMs: null,
      verifiedPlayerIds: [],
      winnerIds: [],
    };
    room.status = 'playing';
    return toSnapshot(room);
  }

  startTurn(socketId: string): RoomSnapshot {
    const { player, room } = this.getActiveTurn(socketId);
    if (room.match?.phase !== 'ready') {
      throw new RoomError(
        'TURN_NOT_READY',
        'Este turno não pode ser iniciado agora.',
      );
    }
    if (room.match.activePlayerId !== player.id) {
      throw new RoomError('NOT_YOUR_TURN', 'Aguarde a sua vez.');
    }
    room.match.phase = 'countdown';
    room.match.countdownEndsAt = this.now() + 3_000;
    return toSnapshot(room);
  }

  beginTiming(code: string, playerId: string): RoomSnapshot {
    const room = this.rooms.get(code);
    const match = room?.match;
    if (
      !room ||
      room.status !== 'playing' ||
      !match ||
      match.phase !== 'countdown' ||
      (room.mode !== 'points' && match.activePlayerId !== playerId)
    ) {
      throw new RoomError(
        'COUNTDOWN_NOT_RUNNING',
        'A contagem não está ativa.',
      );
    }
    if (match.countdownEndsAt !== null && this.now() < match.countdownEndsAt) {
      throw new RoomError(
        'COUNTDOWN_NOT_FINISHED',
        'A contagem ainda não terminou.',
      );
    }
    match.countdownEndsAt = null;
    match.phase = 'timing';
    match.turnStartedAtMs = this.now();
    return toSnapshot(room);
  }

  stopTurn(socketId: string): RoomSnapshot {
    const { player, room } = this.getActiveTurn(socketId);
    const match = room.match;
    if (!match || match.phase !== 'timing' || match.turnStartedAtMs === null) {
      throw new RoomError('TURN_NOT_RUNNING', 'O cronômetro não está rodando.');
    }
    if (room.mode === 'points') {
      if (match.attempts.some((attempt) => attempt.playerId === player.id)) {
        throw new RoomError(
          'TURN_ALREADY_FINISHED',
          'Você já jogou nesta rodada.',
        );
      }
      match.attempts.push({
        elapsedMs: Math.min(
          Math.max(0, this.now() - match.turnStartedAtMs),
          match.targetMs * 2,
        ),
        playerId: player.id,
      });
      if (match.attempts.length === room.players.length) {
        this.resolvePrecisionRound(room);
      }
      return toSnapshot(room);
    }
    if (match.activePlayerId !== player.id) {
      throw new RoomError('NOT_YOUR_TURN', 'Aguarde a sua vez.');
    }

    const elapsedMs = Math.max(0, this.now() - match.turnStartedAtMs);
    this.completeTurn(room, player.id, elapsedMs);
    return toSnapshot(room);
  }

  expireTurn(code: string, playerId: string): RoomSnapshot {
    const room = this.rooms.get(code);
    const match = room?.match;
    if (
      !room ||
      room.status !== 'playing' ||
      !match ||
      match.phase !== 'timing' ||
      match.activePlayerId !== playerId
    ) {
      throw new RoomError('TURN_NOT_RUNNING', 'O cronômetro não está rodando.');
    }
    if (room.mode === 'points') {
      room.players
        .filter(
          (candidate) =>
            !match.attempts.some(
              (attempt) => attempt.playerId === candidate.id,
            ),
        )
        .forEach((candidate) => {
          match.attempts.push({
            elapsedMs: match.targetMs * 2,
            playerId: candidate.id,
          });
        });
      this.resolvePrecisionRound(room);
      return toSnapshot(room);
    }
    this.completeTurn(
      room,
      playerId,
      Math.max(0, match.targetMs * 2 - match.accumulatedMs),
    );
    return toSnapshot(room);
  }

  getRemainingLimitMs(code: string): number {
    const room = this.rooms.get(code);
    const match = room?.match;
    if (!room || !match) return 0;
    return Math.max(0, match.targetMs * 2 - match.accumulatedMs);
  }

  challenge(socketId: string): RoomSnapshot {
    const { player, room } = this.getActiveTurn(socketId);
    const match = room.match;
    if (
      !match ||
      (room.mode !== 'elimination' && room.mode !== 'duos') ||
      match.previousPlayerId === null
    ) {
      throw new RoomError('CHALLENGE_UNAVAILABLE', 'Não há jogador para desafiar.');
    }
    if (match.phase !== 'ready') {
      throw new RoomError('CHALLENGE_UNAVAILABLE', 'A rodada já terminou.');
    }
    if (player.id === match.previousPlayerId) {
      throw new RoomError('INVALID_CHALLENGE', 'Você não pode desafiar a si mesmo.');
    }
    const previousPlayer = room.players.find(
      (candidate) => candidate.id === match.previousPlayerId,
    );
    if (room.mode === 'duos' && player.team === previousPlayer?.team) {
      throw new RoomError(
        'INVALID_CHALLENGE',
        'Você só pode desafiar o time adversário.',
      );
    }
    if (match.challengedByIds.includes(player.id)) {
      throw new RoomError('CHALLENGE_ALREADY_USED', 'Você já desafiou nesta rodada.');
    }

    match.challengedByIds.push(player.id);
    if (room.mode === 'duos') {
      const challengerTeam = player.team;
      const teamMembers = room.players.filter(
        (candidate) => candidate.team === challengerTeam,
      );
      if (
        teamMembers.some(
          (candidate) => !match.challengedByIds.includes(candidate.id),
        )
      ) {
        return toSnapshot(room);
      }
    }
    const previousAttempt = [...match.attempts]
      .reverse()
      .find((attempt) => attempt.playerId === match.previousPlayerId);
    const correct =
      room.mode === 'elimination'
        ? match.accumulatedMs >= match.targetMs
        : (previousAttempt?.elapsedMs ?? 0) >= match.targetMs;
    const winnerId = correct ? player.id : match.previousPlayerId;
    const loserId = correct ? match.previousPlayerId : player.id;
    if (room.mode === 'duos') {
      this.resolveDuosChallenge(
        room,
        winnerId,
        correct ? 'challenge-correct' : 'challenge-wrong',
      );
      return toSnapshot(room);
    }
    this.resolveHotPotatoRound(
      room,
      winnerId,
      loserId,
      correct ? 'challenge-correct' : 'challenge-wrong',
    );
    return toSnapshot(room);
  }

  private resolveDuosChallenge(
    room: InternalRoom,
    winnerId: string,
    resolution: 'challenge-correct' | 'challenge-wrong',
  ): void {
    const match = room.match;
    if (!match) return;
    const winner = room.players.find((candidate) => candidate.id === winnerId);
    if (winner) winner.score += 1;
    match.countdownEndsAt = null;
    match.turnStartedAtMs = null;
    match.winnerIds = [winnerId];
    match.resolution = resolution;
    match.phase = 'result';
    room.status = 'results';
    this.finishPointsChampionship(room);
  }

  private completeTurn(
    room: InternalRoom,
    playerId: string,
    elapsedMs: number,
  ): void {
    const match = room.match;
    if (!match) return;
    if (room.mode === 'elimination') {
      match.accumulatedMs = Math.min(
        match.targetMs * 2,
        match.accumulatedMs + elapsedMs,
      );
      match.attempts.push({ elapsedMs: match.accumulatedMs, playerId });
      match.countdownEndsAt = null;
      match.turnStartedAtMs = null;
      match.previousPlayerId = playerId;

      if (match.accumulatedMs >= match.targetMs * 2) {
        const closest = [...match.attempts].sort(
          (left, right) =>
            Math.abs(left.elapsedMs - match.targetMs) -
            Math.abs(right.elapsedMs - match.targetMs),
        )[0];
        this.resolveHotPotatoRound(
          room,
          closest?.playerId ?? playerId,
          playerId,
          'limit',
        );
        return;
      }

      const activePlayers = room.players
        .filter((candidate) => !candidate.isEliminated)
        .sort((left, right) => left.turnOrder - right.turnOrder);
      const currentIndex = activePlayers.findIndex(
        (candidate) => candidate.id === playerId,
      );
      const nextPlayer = activePlayers[(currentIndex + 1) % activePlayers.length];
      match.activePlayerId = nextPlayer.id;
      match.phase = 'ready';
      match.countdownEndsAt = null;
      return;
    }
    match.attempts.push({ elapsedMs, playerId });
    match.countdownEndsAt = null;
    match.turnStartedAtMs = null;
    match.previousPlayerId = playerId;

    const nextPlayer = [...room.players]
      .sort((left, right) => left.turnOrder - right.turnOrder)
      .find(
        (candidate) =>
          !match.attempts.some((attempt) => attempt.playerId === candidate.id),
      );
    if (nextPlayer) {
      match.activePlayerId = nextPlayer.id;
      match.phase = 'ready';
    } else {
      this.resolvePrecisionRound(room);
    }
  }

  private resolvePrecisionRound(room: InternalRoom): void {
    const match = room.match;
    if (!match) return;
    const bestDifference = Math.min(
      ...match.attempts.map((attempt) =>
        Math.abs(attempt.elapsedMs - match.targetMs),
      ),
    );
    match.winnerIds = [
      ...new Set(
        match.attempts
          .filter(
            (attempt) =>
              Math.abs(attempt.elapsedMs - match.targetMs) === bestDifference,
          )
          .map((attempt) => attempt.playerId),
      ),
    ];
    match.winnerIds.forEach((winnerId) => {
      const winner = room.players.find((candidate) => candidate.id === winnerId);
      if (winner) winner.score += 1;
    });
    match.countdownEndsAt = null;
    match.turnStartedAtMs = null;
    match.resolution = 'closest';
    match.phase = 'result';
    room.status = 'results';
    this.finishPointsChampionship(room);
  }

  private resolveHotPotatoRound(
    room: InternalRoom,
    winnerId: string,
    loserId: string,
    resolution: NonNullable<RoomMatchSnapshot['resolution']>,
  ): void {
    const match = room.match;
    if (!match) return;
    match.countdownEndsAt = null;
    match.turnStartedAtMs = null;
    match.winnerIds = [winnerId];
    match.loserId = loserId;
    match.resolution = resolution;
    match.phase = 'result';
    room.status = 'results';

    if (room.mode === 'points') {
      const winner = room.players.find((candidate) => candidate.id === winnerId);
      if (winner) winner.score += 1;
      this.finishPointsChampionship(room);
      return;
    }

    const loser = room.players.find((candidate) => candidate.id === loserId);
    if (loser?.shieldActive) loser.shieldActive = false;
    else if (loser) loser.isEliminated = true;
    const survivors = room.players.filter((candidate) => !candidate.isEliminated);
    if (survivors.length === 1) {
      match.championId = survivors[0].id;
      room.status = 'finished';
    }
  }

  private finishPointsChampionship(room: InternalRoom): void {
    const match = room.match;
    if (!match || match.currentRound < match.totalRounds) return;
    const standings =
      room.mode === 'duos'
        ? (['AB', 'CD'] as const).map((team) => ({
            contestantId: team,
            score: room.players
              .filter((candidate) => candidate.team === team)
              .reduce((total, candidate) => total + candidate.score, 0),
          }))
        : room.players.map((candidate) => ({
            contestantId: candidate.id,
            score: candidate.score,
          }));
    const championship = resolveChampionship(
      standings,
      match.currentRound,
      match.totalRounds,
    );
    if (championship.status === 'finished') {
      match.championId = championship.championId;
      room.status = 'finished';
    }
  }

  verifyTime(socketId: string): RoomSnapshot {
    const { player, room } = this.getActiveTurn(socketId);
    const match = room.match;
    if (!match || match.phase !== 'verification') {
      throw new RoomError(
        'VERIFICATION_NOT_OPEN',
        'A verificação abre depois que todos jogarem.',
      );
    }
    if (match.verifiedPlayerIds.includes(player.id)) {
      throw new RoomError(
        'VERIFICATION_ALREADY_USED',
        'Você já verificou o tempo nesta rodada.',
      );
    }

    match.verifiedPlayerIds.push(player.id);
    if (match.verifiedPlayerIds.length === room.players.length) {
      const result = resolveMultiplayerRound(
        match.targetMs,
        match.targetMs * 2,
        match.attempts.map((attempt) => ({
          contestantId: attempt.playerId,
          elapsedMs: attempt.elapsedMs,
        })),
        room.players.map(({ id }) => id),
      );
      if (result.status === 'closed') {
        match.winnerIds = result.winnerIds;
        if (result.winnerIds.length === 1) {
          const winner = room.players.find(
            (candidate) => candidate.id === result.winnerIds[0],
          );
          if (winner) winner.score += 1;
        }
      }
      match.phase = 'result';
      room.status = 'results';
      if (match.currentRound >= match.totalRounds) {
        const standings =
          room.mode === 'duos'
            ? (['AB', 'CD'] as const).map((team) => ({
                contestantId: team,
                score: room.players
                  .filter((candidate) => candidate.team === team)
                  .reduce((total, candidate) => total + candidate.score, 0),
              }))
            : room.players.map((candidate) => ({
                contestantId: candidate.id,
                score: candidate.score,
              }));
        const championship = resolveChampionship(
          standings,
          match.currentRound,
          match.totalRounds,
        );
        if (championship.status === 'finished') {
          match.championId = championship.championId;
          room.status = 'finished';
        }
      }
    }
    return toSnapshot(room);
  }

  advanceRound(code: string): RoomSnapshot {
    const room = this.rooms.get(code);
    if (!room || !room.match) {
      throw new RoomError(
        'GAME_NOT_RUNNING',
        'A partida não está em andamento.',
      );
    }
    if (room.status === 'finished') {
      throw new RoomError('GAME_FINISHED', 'A partida já terminou.');
    }
    if (room.match.phase !== 'result') {
      throw new RoomError(
        'ROUND_NOT_FINISHED',
        'A rodada atual ainda não terminou.',
      );
    }

    const firstPlayer = [...room.players].sort(
      (left, right) => left.turnOrder - right.turnOrder,
    )[0];
    room.match = {
      activePlayerId: firstPlayer.id,
      accumulatedMs: 0,
      attempts: [],
      challengedByIds: [],
      championId: null,
      countdownEndsAt: room.mode === 'points' ? this.now() + 3_000 : null,
      currentRound: room.match.currentRound + 1,
      isTiebreak: room.match.currentRound >= room.match.totalRounds,
      loserId: null,
      phase: room.mode === 'points' ? 'countdown' : 'ready',
      previousPlayerId: null,
      resolution: null,
      targetMs: this.targetForMode(room.mode),
      totalRounds: room.match.totalRounds,
      turnStartedAtMs: null,
      verifiedPlayerIds: [],
      winnerIds: [],
    };
    room.status = 'playing';
    return toSnapshot(room);
  }

  advanceRoundForHost(socketId: string): RoomSnapshot {
    const code = this.roomBySocket.get(socketId);
    const room = code ? this.rooms.get(code) : undefined;
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Sala não encontrada.');
    const player = room.players.find(
      (candidate) => candidate.socketId === socketId,
    );
    if (!player?.isHost) {
      throw new RoomError(
        'HOST_ONLY',
        'Somente o host pode iniciar a próxima rodada.',
      );
    }
    return this.advanceRound(room.code);
  }

  private getActiveTurn(socketId: string): {
    player: InternalPlayer;
    room: InternalRoom;
  } {
    const code = this.roomBySocket.get(socketId);
    const room = code ? this.rooms.get(code) : undefined;
    if (!room || room.status !== 'playing' || !room.match) {
      throw new RoomError(
        'GAME_NOT_RUNNING',
        'A partida não está em andamento.',
      );
    }
    const player = room.players.find(
      (candidate) => candidate.socketId === socketId,
    );
    if (!player)
      throw new RoomError('PLAYER_NOT_FOUND', 'Jogador não encontrado.');
    return { player, room };
  }

  private assertSocketAvailable(socketId: string) {
    if (this.roomBySocket.has(socketId)) {
      throw new RoomError('ALREADY_IN_ROOM', 'Você já está em uma sala.');
    }
  }

  private shuffleActiveTurnOrder(room: InternalRoom): void {
    const activePlayers = room.players.filter(
      (candidate) => !candidate.isEliminated,
    );
    for (let index = activePlayers.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.random() * (index + 1));
      [activePlayers[index], activePlayers[swapIndex]] = [
        activePlayers[swapIndex],
        activePlayers[index],
      ];
    }
    activePlayers.forEach((candidate, index) => {
      candidate.turnOrder = index + 1;
    });
  }

  private targetForMode(mode: RoomSnapshot['mode']): number {
    if (mode === 'points') return this.createTarget();

    // Turn-based rounds need enough room for the hot-potato handoff.
    return 8_000 + Math.floor(this.random() * 12_001);
  }

  private createUniqueCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = this.createCode().toUpperCase();
      if (/^[A-Z0-9]{5}$/.test(code) && !this.rooms.has(code)) return code;
    }
    throw new RoomError(
      'CODE_GENERATION_FAILED',
      'Não foi possível gerar o código da sala.',
    );
  }
}

function createPlayer(
  nickname: string,
  socketId: string,
  isHost: boolean,
  order: number,
  role: Pick<RoomPlayer, 'slot' | 'team' | 'turnOrder'>,
): InternalPlayer {
  return {
    id: randomUUID(),
    isEliminated: false,
    isHost,
    isReady: isHost,
    nickname,
    order,
    score: 0,
    shieldActive: true,
    socketId,
    ...role,
    token: randomUUID(),
  };
}

function normalizeNickname(value: string): string {
  const nickname = value.trim().replace(/\s+/g, ' ');
  if (nickname.length < 2 || nickname.length > 16) {
    throw new RoomError(
      'INVALID_NICKNAME',
      'Use um nickname entre 2 e 16 caracteres.',
    );
  }
  if (!/^[\p{L}\p{N}_ -]+$/u.test(nickname)) {
    throw new RoomError(
      'INVALID_NICKNAME',
      'O nickname contém caracteres inválidos.',
    );
  }
  return nickname;
}

function toSnapshot(room: InternalRoom): RoomSnapshot {
  return {
    autoAdvance: room.autoAdvance,
    code: room.code,
    match: room.match
      ? {
          activePlayerId: room.match.activePlayerId,
          attempts:
            room.mode !== 'duos' && room.status === 'playing'
              ? room.match.attempts.map((attempt) => ({
                  ...attempt,
                  elapsedMs: 0,
                }))
              : room.match.attempts,
          challengedByIds: room.match.challengedByIds,
          championId: room.match.championId,
          countdownEndsAt: room.match.countdownEndsAt,
          currentRound: room.match.currentRound,
          isTiebreak: room.match.isTiebreak,
          loserId: room.match.loserId,
          phase: room.match.phase,
          previousPlayerId: room.match.previousPlayerId,
          resolution: room.match.resolution,
          targetMs: room.match.targetMs,
          totalRounds: room.match.totalRounds,
          verifiedPlayerIds: room.match.verifiedPlayerIds,
          winnerIds: room.match.winnerIds,
        }
      : null,
    maxPlayers: room.maxPlayers,
    mode: room.mode,
    players: room.players.map((player) => ({
      id: player.id,
      isEliminated: player.isEliminated,
      isHost: player.isHost,
      isReady: player.isReady,
      nickname: player.nickname,
      order: player.order,
      score: player.score,
      shieldActive: player.shieldActive,
      slot: player.slot,
      team: player.team,
      turnOrder: player.turnOrder,
    })),
    rounds: room.rounds,
    status: room.status,
  };
}

function playerRoleFor(
  mode: RoomSnapshot['mode'],
  order: number,
): Pick<RoomPlayer, 'slot' | 'team' | 'turnOrder'> {
  if (mode !== 'duos') return { slot: null, team: null, turnOrder: order };

  const slots = ['A', 'B', 'C', 'D'] as const;
  const turnOrders = [1, 3, 2, 4] as const;
  return {
    slot: slots[order - 1],
    team: order <= 2 ? 'AB' : 'CD',
    turnOrder: turnOrders[order - 1],
  };
}

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: 5 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');
}
