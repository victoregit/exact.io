export const SocketEvents = {
  CONNECTION_HELLO: 'connection:hello',
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_READY: 'room:ready',
  ROOM_AUTO_ADVANCE: 'room:auto-advance',
  ROOM_STATE: 'room:state',
  GAME_START: 'game:start',
  ROUND_PREPARE: 'round:prepare',
  ROUND_NEXT: 'round:next',
  ROUND_START: 'round:start',
  ROUND_STOP: 'round:stop',
  ROUND_CHALLENGE: 'round:challenge',
  ROUND_RESULT: 'round:result',
  ROUND_VERIFY: 'round:verify',
  GAME_END: 'game:end',
} as const;

export type RoomMode = 'points' | 'elimination' | 'duos';
export type PlayerSlot = 'A' | 'B' | 'C' | 'D';
export type PlayerTeam = 'AB' | 'CD';
export type RoomStatus =
  'waiting' | 'countdown' | 'playing' | 'results' | 'finished';

export interface RoomPlayer {
  id: string;
  isEliminated: boolean;
  isHost: boolean;
  nickname: string;
  order: number;
  isReady: boolean;
  score: number;
  shieldActive: boolean;
  slot: PlayerSlot | null;
  team: PlayerTeam | null;
  turnOrder: number;
}

export interface RoomSnapshot {
  autoAdvance: boolean;
  code: string;
  match: RoomMatchSnapshot | null;
  maxPlayers: number;
  mode: RoomMode;
  players: RoomPlayer[];
  rounds: 5 | 10;
  status: RoomStatus;
}

export interface RoomMatchSnapshot {
  activePlayerId: string;
  attempts: RoomAttemptSnapshot[];
  challengedByIds: string[];
  championId: string | null;
  countdownEndsAt: number | null;
  currentRound: number;
  isTiebreak: boolean;
  loserId: string | null;
  phase: 'countdown' | 'ready' | 'result' | 'timing' | 'verification';
  previousPlayerId: string | null;
  resolution:
    'challenge-correct' | 'challenge-wrong' | 'closest' | 'limit' | null;
  targetMs: number;
  totalRounds: number;
  verifiedPlayerIds: string[];
  winnerIds: string[];
}

export interface RoomAttemptSnapshot {
  elapsedMs: number;
  playerId: string;
}

export interface ConnectionHelloPayload {
  clientVersion: string;
}

export interface ConnectionReadyPayload {
  connectedAt: string;
  socketId: string;
}

export interface CreateRoomPayload {
  maxPlayers: number;
  mode: RoomMode;
  nickname: string;
  rounds: 5 | 10;
}

export interface JoinRoomPayload {
  code: string;
  nickname: string;
}

export type RoomActionResponse =
  | { ok: true; playerToken: string; room: RoomSnapshot }
  | { code: string; message: string; ok: false };

export type LeaveRoomResponse = { ok: true } | { message: string; ok: false };
export type GameActionResponse =
  | { ok: true; room: RoomSnapshot }
  | { code: string; message: string; ok: false };

export interface ClientToServerEvents {
  'connection:hello': (
    payload: ConnectionHelloPayload,
    acknowledge: (response: ConnectionReadyPayload) => void,
  ) => void;
  'room:create': (
    payload: CreateRoomPayload,
    acknowledge: (response: RoomActionResponse) => void,
  ) => void;
  'room:join': (
    payload: JoinRoomPayload,
    acknowledge: (response: RoomActionResponse) => void,
  ) => void;
  'room:leave': (acknowledge: (response: LeaveRoomResponse) => void) => void;
  'room:ready': (
    ready: boolean,
    acknowledge: (response: GameActionResponse) => void,
  ) => void;
  'room:auto-advance': (
    enabled: boolean,
    acknowledge: (response: GameActionResponse) => void,
  ) => void;
  'game:start': (acknowledge: (response: GameActionResponse) => void) => void;
  'round:start': (acknowledge: (response: GameActionResponse) => void) => void;
  'round:stop': (acknowledge: (response: GameActionResponse) => void) => void;
  'round:challenge': (
    acknowledge: (response: GameActionResponse) => void,
  ) => void;
  'round:verify': (acknowledge: (response: GameActionResponse) => void) => void;
  'round:next': (acknowledge: (response: GameActionResponse) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (room: RoomSnapshot) => void;
}
