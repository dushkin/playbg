import { Server as SocketIOServer } from 'socket.io';
import winston from 'winston';
declare const app: import("express-serve-static-core").Express;
declare const io: SocketIOServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
declare const logger: winston.Logger;
export { app, io, logger };
//# sourceMappingURL=server.d.ts.map