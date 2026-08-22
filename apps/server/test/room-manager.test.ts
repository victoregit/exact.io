import { describe, expect, it } from 'vitest';

import { RoomError, RoomManager } from '../src/rooms/room-manager.js';

const roomOptions = {
  maxPlayers: 3,
  mode: 'elimination' as const,
  nickname: 'Victor',
  rounds: 5 as const,
};

describe('RoomManager', () => {
  it('creates a room with a host and active shield', () => {
    const manager = new RoomManager(() => 'AB7K2');
    const { room, playerToken } = manager.create(roomOptions, 'socket-1');

    expect(room.code).toBe('AB7K2');
    expect(playerToken).toBeTruthy();
    expect(room.players[0]).toMatchObject({
      isHost: true,
      nickname: 'Victor',
      order: 1,
      shieldActive: true,
    });
  });

  it('joins players in order and rejects duplicate nicknames', () => {
    const manager = new RoomManager(() => 'AB7K2');
    manager.create(roomOptions, 'socket-1');
    const { room } = manager.join(
      { code: 'ab7k2', nickname: 'Ana' },
      'socket-2',
    );

    expect(
      room.players.map(({ nickname, order }) => ({ nickname, order })),
    ).toEqual([
      { nickname: 'Victor', order: 1 },
      { nickname: 'Ana', order: 2 },
    ]);
    expect(() =>
      manager.join({ code: 'AB7K2', nickname: 'ana' }, 'socket-3'),
    ).toThrowError(RoomError);
  });

  it('enforces capacity and promotes a new host when the host leaves', () => {
    const manager = new RoomManager(() => 'AB7K2');
    manager.create({ ...roomOptions, maxPlayers: 2 }, 'socket-1');
    manager.join({ code: 'AB7K2', nickname: 'Ana' }, 'socket-2');

    expect(() =>
      manager.join({ code: 'AB7K2', nickname: 'João' }, 'socket-3'),
    ).toThrowError('Esta sala está cheia.');
    const departure = manager.leave('socket-1');
    expect(departure?.room?.players[0]).toMatchObject({
      isHost: true,
      nickname: 'Ana',
      order: 1,
    });
  });

  it('deletes an empty room', () => {
    const manager = new RoomManager(() => 'AB7K2');
    manager.create(roomOptions, 'socket-1');
    expect(manager.leave('socket-1')).toEqual({ code: 'AB7K2', room: null });
    expect(() =>
      manager.join({ code: 'AB7K2', nickname: 'Ana' }, 'socket-2'),
    ).toThrowError('Sala não encontrada.');
  });

  it('creates balanced teams in a four-player duos room', () => {
    const manager = new RoomManager(() => 'DUO22');
    manager.create({ ...roomOptions, maxPlayers: 4, mode: 'duos' }, 'socket-1');
    manager.join({ code: 'DUO22', nickname: 'Ana' }, 'socket-2');
    manager.join({ code: 'DUO22', nickname: 'João' }, 'socket-3');
    const { room } = manager.join(
      { code: 'DUO22', nickname: 'Bia' },
      'socket-4',
    );

    expect(
      room.players.map(({ nickname, slot, team, turnOrder }) => ({
        nickname,
        slot,
        team,
        turnOrder,
      })),
    ).toEqual([
      { nickname: 'Victor', slot: 'A', team: 'AB', turnOrder: 1 },
      { nickname: 'Ana', slot: 'B', team: 'AB', turnOrder: 3 },
      { nickname: 'João', slot: 'C', team: 'CD', turnOrder: 2 },
      { nickname: 'Bia', slot: 'D', team: 'CD', turnOrder: 4 },
    ]);
    expect(
      [...room.players]
        .sort((left, right) => left.turnOrder - right.turnOrder)
        .map((player) => player.slot),
    ).toEqual(['A', 'C', 'B', 'D']);
    expect(() =>
      new RoomManager(() => 'BAD22').create(
        { ...roomOptions, maxPlayers: 3, mode: 'duos' },
        'socket-x',
      ),
    ).toThrowError('O modo Duplas precisa de exatamente 4 vagas.');
  });

  it('starts with the first turn and a server-generated target', () => {
    const manager = new RoomManager(
      () => 'START',
      () => 7_000,
    );
    manager.create({ ...roomOptions, mode: 'points' }, 'socket-1');
    manager.join({ code: 'START', nickname: 'Ana' }, 'socket-2');
    manager.setReady('socket-2', true);

    const room = manager.start('socket-1');

    expect(room.status).toBe('playing');
    expect(room.match).toEqual({
      activePlayerId: room.players[0].id,
      attempts: [],
      championId: null,
      countdownEndsAt: null,
      currentRound: 1,
      isTiebreak: false,
      phase: 'ready',
      targetMs: 7_000,
      totalRounds: 5,
      verifiedPlayerIds: [],
      winnerIds: [],
    });
    expect(() => manager.start('socket-2')).toThrow(
      'Somente o host pode iniciar a partida.',
    );
  });

  it('measures each turn on the server and advances to the next player', () => {
    let now = 1_000;
    const manager = new RoomManager(
      () => 'TURNS',
      () => 7_000,
      () => now,
    );
    manager.create({ ...roomOptions, mode: 'points' }, 'socket-1');
    manager.join({ code: 'TURNS', nickname: 'Ana' }, 'socket-2');
    manager.setReady('socket-2', true);
    const game = manager.start('socket-1');

    expect(() => manager.startTurn('socket-2')).toThrow('Aguarde a sua vez.');
    expect(manager.startTurn('socket-1').match).toMatchObject({
      countdownEndsAt: 4_000,
      phase: 'countdown',
    });
    now = 4_000;
    expect(manager.beginTiming('TURNS', game.players[0].id).match?.phase).toBe(
      'timing',
    );
    now = 11_020;
    const afterHost = manager.stopTurn('socket-1');

    expect(afterHost.match).toMatchObject({
      activePlayerId: afterHost.players[1].id,
      attempts: [{ elapsedMs: 7_020, playerId: afterHost.players[0].id }],
      phase: 'ready',
    });
    manager.startTurn('socket-2');
    now = 14_020;
    manager.beginTiming('TURNS', afterHost.players[1].id);
    now = 21_010;
    expect(manager.stopTurn('socket-2').match).toMatchObject({
      phase: 'verification',
    });
    expect(manager.verifyTime('socket-1').match).toMatchObject({
      phase: 'verification',
      verifiedPlayerIds: [afterHost.players[0].id],
    });
    expect(() => manager.verifyTime('socket-1')).toThrow(
      'Você já verificou o tempo nesta rodada.',
    );
    const result = manager.verifyTime('socket-2');
    expect(result.status).toBe('results');
    expect(result.match).toMatchObject({
      phase: 'result',
      winnerIds: [result.players[1].id],
    });
    expect(result.players[1].score).toBe(1);
    const nextRound = manager.advanceRound('TURNS');
    expect(nextRound.match).toMatchObject({
      attempts: [],
      currentRound: 2,
      phase: 'ready',
      verifiedPlayerIds: [],
      winnerIds: [],
    });
    expect(nextRound.players[1].score).toBe(1);
  });

  it('requires every guest to be ready before the host starts', () => {
    const manager = new RoomManager(
      () => 'READY',
      () => 7_000,
    );
    manager.create({ ...roomOptions, mode: 'points' }, 'socket-1');
    manager.join({ code: 'READY', nickname: 'Ana' }, 'socket-2');

    expect(() => manager.start('socket-1')).toThrow(
      'Aguarde todos os jogadores marcarem READY.',
    );
    expect(manager.setReady('socket-2', true).players[1].isReady).toBe(true);
    expect(manager.start('socket-1').status).toBe('playing');
  });

  it('automatically closes a turn at double the target', () => {
    let now = 1_000;
    const manager = new RoomManager(
      () => 'LIMIT',
      () => 7_000,
      () => now,
    );
    manager.create({ ...roomOptions, mode: 'points' }, 'socket-1');
    manager.join({ code: 'LIMIT', nickname: 'Ana' }, 'socket-2');
    manager.setReady('socket-2', true);
    const game = manager.start('socket-1');
    manager.startTurn('socket-1');
    now = 4_000;
    manager.beginTiming('LIMIT', game.players[0].id);

    const expired = manager.expireTurn('LIMIT', game.players[0].id);

    expect(expired.match).toMatchObject({
      activePlayerId: game.players[1].id,
      attempts: [{ elapsedMs: 14_000, playerId: game.players[0].id }],
      phase: 'ready',
    });
    expect(() => manager.expireTurn('LIMIT', game.players[0].id)).toThrow(
      'O cronômetro não está rodando.',
    );
  });

  it('keeps manual advance as default and lets only the host enable automatic advance', () => {
    const manager = new RoomManager(() => 'AUTO1');
    const created = manager.create(roomOptions, 'socket-1');
    manager.join({ code: 'AUTO1', nickname: 'Ana' }, 'socket-2');

    expect(created.room.autoAdvance).toBe(false);
    expect(() => manager.setAutoAdvance('socket-2', true)).toThrow(
      'Somente o host pode alterar o início automático.',
    );
    expect(manager.setAutoAdvance('socket-1', true).autoAdvance).toBe(true);
  });
});
