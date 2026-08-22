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

    socket.on(SocketEvents.GAME_START, (acknowledge) => {
      try {
        const room = rooms.start(socket.id);
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
