import {
  SocketEvents,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@exact-io/shared';
import type { FastifyInstance } from 'fastify';
import { Server as SocketServer } from 'socket.io';

import { RoomError, RoomManager } from './rooms/room-manager.js';

export function registerRealtime(app: FastifyInstance) {
  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(
    app.server,
    {
      cors: {
        origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
      },
    },
  );
  const rooms = new RoomManager();

  io.on('connection', (socket) => {
    socket.on(SocketEvents.CONNECTION_HELLO, (_payload, acknowledge) => {
      acknowledge({
        connectedAt: new Date().toISOString(),
        socketId: socket.id,
      });
    });

    socket.on(SocketEvents.ROOM_CREATE, (payload, acknowledge) => {
      try {
        const result = rooms.create(payload, socket.id);
        void socket.join(result.room.code);
        acknowledge({ ok: true, ...result });
        io.to(result.room.code).emit(SocketEvents.ROOM_STATE, result.room);
      } catch (error) {
        acknowledge(toRoomError(error));
      }
    });

    socket.on(SocketEvents.ROOM_JOIN, (payload, acknowledge) => {
      try {
        const result = rooms.join(payload, socket.id);
        void socket.join(result.room.code);
        acknowledge({ ok: true, ...result });
        io.to(result.room.code).emit(SocketEvents.ROOM_STATE, result.room);
      } catch (error) {
        acknowledge(toRoomError(error));
      }
    });

    socket.on(SocketEvents.ROOM_LEAVE, (acknowledge) => {
      const departure = rooms.leave(socket.id);
      if (!departure) {
        acknowledge({ message: 'Você não está em uma sala.', ok: false });
        return;
      }
      void socket.leave(departure.code);
      if (departure.room) {
        io.to(departure.code).emit(SocketEvents.ROOM_STATE, departure.room);
      }
      acknowledge({ ok: true });
    });

    socket.on(SocketEvents.ROOM_READY, (ready, acknowledge) => {
      try {
        const room = rooms.setReady(socket.id, ready);
        acknowledge({ ok: true, room });
        io.to(room.code).emit(SocketEvents.ROOM_STATE, room);
      } catch (error) {
        acknowledge(toRoomError(error));
      }
    });

    socket.on(SocketEvents.ROOM_AUTO_ADVANCE, (enabled, acknowledge) => {
      try {
        const room = rooms.setAutoAdvance(socket.id, enabled);
        acknowledge({ ok: true, room });
        io.to(room.code).emit(SocketEvents.ROOM_STATE, room);
        if (enabled && room.status === 'results') {
          setTimeout(() => {
            try {
              const nextRoom = rooms.advanceRound(room.code);
              io.to(nextRoom.code).emit(SocketEvents.ROOM_STATE, nextRoom);
            } catch {
              // The room may have advanced or closed meanwhile.
            }
          }, 4_000);
        }
      } catch (error) {
        acknowledge(toRoomError(error));
      }
    });

    socket.on(SocketEvents.GAME_START, (acknowledge) => {
      try {
        const room = rooms.start(socket.id);
        acknowledge({ ok: true, room });
        io.to(room.code).emit(SocketEvents.ROOM_STATE, room);
      } catch (error) {
        acknowledge(toRoomError(error));
      }
    });

    socket.on(SocketEvents.ROUND_START, (acknowledge) => {
      try {
        const room = rooms.startTurn(socket.id);
        acknowledge({ ok: true, room });
        io.to(room.code).emit(SocketEvents.ROOM_STATE, room);
        const activePlayerId = room.match?.activePlayerId;
        if (activePlayerId) {
          setTimeout(() => {
            try {
              const timingRoom = rooms.beginTiming(room.code, activePlayerId);
              io.to(timingRoom.code).emit(SocketEvents.ROOM_STATE, timingRoom);
              const limitMs = (timingRoom.match?.targetMs ?? 0) * 2;
              setTimeout(() => {
                try {
                  const expiredRoom = rooms.expireTurn(
                    timingRoom.code,
                    activePlayerId,
                  );
                  io.to(expiredRoom.code).emit(
                    SocketEvents.ROOM_STATE,
                    expiredRoom,
                  );
                } catch {
                  // The player may have stopped before reaching the limit.
                }
              }, limitMs);
            } catch {
              // The turn may have been interrupted while counting down.
            }
          }, 3_000);
        }
      } catch (error) {
        acknowledge(toRoomError(error));
      }
    });

    socket.on(SocketEvents.ROUND_STOP, (acknowledge) => {
      try {
        const room = rooms.stopTurn(socket.id);
        acknowledge({ ok: true, room });
        io.to(room.code).emit(SocketEvents.ROOM_STATE, room);
      } catch (error) {
        acknowledge(toRoomError(error));
      }
    });

    socket.on(SocketEvents.ROUND_VERIFY, (acknowledge) => {
      try {
        const room = rooms.verifyTime(socket.id);
        acknowledge({ ok: true, room });
        io.to(room.code).emit(SocketEvents.ROOM_STATE, room);
        if (room.autoAdvance && room.status === 'results') {
          setTimeout(() => {
            try {
              const nextRoom = rooms.advanceRound(room.code);
              io.to(nextRoom.code).emit(SocketEvents.ROOM_STATE, nextRoom);
            } catch {
              // The room may have been closed while showing the result.
            }
          }, 4_000);
        }
      } catch (error) {
        acknowledge(toRoomError(error));
      }
    });

    socket.on(SocketEvents.ROUND_NEXT, (acknowledge) => {
      try {
        const room = rooms.advanceRoundForHost(socket.id);
        acknowledge({ ok: true, room });
        io.to(room.code).emit(SocketEvents.ROOM_STATE, room);
      } catch (error) {
        acknowledge(toRoomError(error));
      }
    });

    socket.on('disconnect', () => {
      const departure = rooms.leave(socket.id);
      if (departure?.room) {
        io.to(departure.code).emit(SocketEvents.ROOM_STATE, departure.room);
      }
    });
  });

  app.addHook('onClose', async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });

  return io;
}

function toRoomError(error: unknown) {
  if (error instanceof RoomError) {
    return { code: error.code, message: error.message, ok: false as const };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: 'Não foi possível concluir esta ação.',
    ok: false as const,
  };
}
