import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export const setSocketServer = (server: SocketIOServer) => {
  io = server;
};

export const getSocketServer = () => {
  return io;
};

export const emitToAll = (event: string, data: any) => {
  if (io) {
    io.emit(event, data);
  }
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

export const emitGameUpdate = (event: string, data: any) => {
  if (io) {
    // Emit to all connected clients for game list updates
    io.emit(event, data);
  }
};