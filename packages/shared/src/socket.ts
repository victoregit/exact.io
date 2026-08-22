export const SocketEvents = {
  CONNECTION_HELLO: 'connection:hello',
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_READY: 'room:ready',
  ROOM_STATE: 'room:state',
  GAME_START: 'game:start',
  ROUND_PREPARE: 'round:prepare',
  ROUND_START: 'round:start',
  ROUND_STOP: 'round:stop',
  ROUND_RESULT: 'round:result',
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
  currentRound: number;
  isTiebreak: boolean;
  targetMs: number;
  totalRounds: number;
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
  'game:start': (acknowledge: (response: GameActionResponse) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (room: RoomSnapshot) => void;
}
