import {
  SocketEvents,
  type ClientToServerEvents,
  type ConnectionReadyPayload,
  type RoomActionResponse,
  type RoomSnapshot,
  type ServerToClientEvents,
} from '@exact-io/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { io as createSocket, type Socket } from 'socket.io-client';

import { buildApp } from '../src/app.js';

const apps: ReturnType<typeof buildApp>[] = [];
const sockets: Socket<ServerToClientEvents, ClientToServerEvents>[] = [];

afterEach(async () => {
  sockets.splice(0).forEach((socket) => socket.close());
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('realtime connection', () => {
  it('acknowledges a typed client handshake', async () => {
    const app = buildApp();
    apps.push(app);
    await app.listen({ host: '127.0.0.1', port: 0 });

    const address = app.server.address();
    if (!address || typeof address === 'string')
      throw new Error('Expected a TCP server address');

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
      createSocket(`http://127.0.0.1:${address.port}`, {
        forceNew: true,
        reconnection: false,
      });
    sockets.push(socket);

    const response = await new Promise<ConnectionReadyPayload>(
      (resolve, reject) => {
        socket.on('connect_error', reject);
        socket.on('connect', () => {
          socket.emit(
            SocketEvents.CONNECTION_HELLO,
            { clientVersion: 'test' },
            resolve,
          );
        });
      },
    );

    expect(response.socketId).toBe(socket.id);
    expect(Number.isNaN(Date.parse(response.connectedAt))).toBe(false);
  });

  it('synchronizes a private room between two clients', async () => {
    const app = buildApp();
    apps.push(app);
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string')
      throw new Error('Expected a TCP server address');

    const host = await connectClient(address.port);
    const guest = await connectClient(address.port);
    const created = await new Promise<RoomActionResponse>((resolve) => {
      host.emit(
        SocketEvents.ROOM_CREATE,
        { maxPlayers: 4, mode: 'elimination', nickname: 'Victor', rounds: 5 },
        resolve,
      );
    });
    if (!created.ok) throw new Error(created.message);

    const hostUpdate = new Promise<RoomSnapshot>((resolve) => {
      host.once(SocketEvents.ROOM_STATE, resolve);
    });
    const joined = new Promise<RoomActionResponse>((resolve) => {
      guest.emit(
        SocketEvents.ROOM_JOIN,
        { code: created.room.code, nickname: 'Ana' },
        resolve,
      );
    });

    const [updatedRoom, joinResponse] = await Promise.all([hostUpdate, joined]);
    expect(joinResponse.ok).toBe(true);
    expect(updatedRoom.players.map((player) => player.nickname)).toEqual([
      'Victor',
      'Ana',
    ]);
  });
});

async function connectClient(port: number) {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
    createSocket(`http://127.0.0.1:${port}`, {
      forceNew: true,
      reconnection: false,
    });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });
  return socket;
}
