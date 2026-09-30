import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { buildOriginCheck } from '../config/cors';

/** Applies the same CORS rules as the REST API to Socket.IO connections. */
export class SocketIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: buildOriginCheck(), credentials: true },
    } as ServerOptions);
  }
}
