import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  emit: Socket['emit'];
  handshake: Socket['handshake'];
  id: Socket['id'];
  join: Socket['join'];
  on: Socket['on'];
  leave: Socket['leave'];
  to: Socket['to'];
  broadcast: Socket['broadcast'];
}