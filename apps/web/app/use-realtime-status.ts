'use client';

import {
  SocketEvents,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@exact-io/shared';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export type RealtimeStatus = 'connecting' | 'online' | 'offline';

export function useRealtimeStatus(): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
      { reconnection: true },
    );

    socket.on('connect', () => {
      socket.emit(
        SocketEvents.CONNECTION_HELLO,
        { clientVersion: '0.1.0' },
        () => setStatus('online'),
      );
    });
    socket.on('disconnect', () => setStatus('offline'));
    socket.on('connect_error', () => setStatus('offline'));

    return () => {
      socket.close();
    };
  }, []);

  return status;
}
