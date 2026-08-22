import { randomUUID } from 'node:crypto';

import type {
  CreateRoomPayload,
  JoinRoomPayload,
  RoomPlayer,
  RoomSnapshot,
} from '@exact-io/shared';
import { generateTargetMs } from '@exact-io/shared';

interface InternalPlayer extends RoomPlayer {
  socketId: string;
  token: string;
}

interface InternalRoom extends Omit<RoomSnapshot, 'players'> {
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

    const firstPlayer = [...room.players].sort(
      (left, right) => left.turnOrder - right.turnOrder,
    )[0];
    room.match = {
      activePlayerId: firstPlayer.id,
      currentRound: 1,
      isTiebreak: false,
      targetMs: this.createTarget(),
      totalRounds: room.rounds,
    };
    room.status = 'playing';
    return toSnapshot(room);
  }

  private assertSocketAvailable(socketId: string) {
    if (this.roomBySocket.has(socketId)) {
      throw new RoomError('ALREADY_IN_ROOM', 'Você já está em uma sala.');
    }
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
    code: room.code,
    match: room.match,
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
