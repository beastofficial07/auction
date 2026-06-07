import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_API_URL    ||
  'http://localhost:5000';

let socket: Socket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const getSocket = (): Socket => {
  // Reuse existing connected socket
  if (socket?.connected) return socket;

  // Clean up old disconnected socket
  if (socket && !socket.connected) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const token = getToken();

  socket = io(SOCKET_URL, {
    withCredentials:      true,
    transports:           ['websocket', 'polling'],
    auth:                 token ? { token } : {},
    reconnection:         true,
    reconnectionAttempts: 20,
    reconnectionDelay:    1000,
    reconnectionDelayMax: 5000,
    timeout:              20000,
    forceNew:             false,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket?.id);
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason);
    // Server-forced disconnect → reconnect manually after delay
    if (reason === 'io server disconnect') {
      reconnectTimer = setTimeout(() => { socket?.connect(); }, 2000);
    }
  });

  socket.on('connect_error', (err) => {
    console.error('⚠️ Socket error:', err.message);
  });

  socket.on('reconnect', (attempt) => {
    console.log(`♻️  Socket reconnected after ${attempt} attempt(s)`);
  });

  return socket;
};

/** Emit to the currently connected socket (no-op if not connected) */
export const emit = (event: string, data?: any) => {
  const s = getSocket();
  if (s.connected) s.emit(event, data);
};

export const disconnectSocket = () => {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
};
