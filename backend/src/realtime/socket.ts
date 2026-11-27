import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer, type Socket } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import { verificarAcceso } from '../middleware/autenticar';
import type { ContextoUsuario } from '../shared/contexto';
import { ErrorNoAutenticado } from '../shared/errores';

/**
 * Capa de tiempo real (Socket.IO) sobre el mismo servidor HTTP de Express.
 *
 * Opera 100% en red local (LAN) sin dependencias externas: autentica cada
 * handshake con el mismo JWT de la API REST y aisla a cada cliente en la sala
 * exclusiva de su predio (`predio:<id_predio>`).
 */

export type EventoAlertaWs = 'alerta:nueva' | 'alerta:recordatorio' | 'alerta:actualizada';

export interface EmisorAlertas {
  emitirAPredio(idPredio: string, evento: EventoAlertaWs, payload: unknown): void;
}

interface SocketData {
  ctx?: ContextoUsuario;
}

let ioInstancia: SocketServer | null = null;

export function salaPredio(idPredio: string): string {
  return `predio:${idPredio}`;
}

export function salaUsuario(idUsuario: string): string {
  return `usuario:${idUsuario}`;
}

function extraerTokenHandshake(socket: Socket): string | null {
  const desdeAuth = socket.handshake.auth?.token;
  if (typeof desdeAuth === 'string' && desdeAuth.trim().length > 0) {
    return desdeAuth.trim();
  }

  const cabecera = socket.handshake.headers.authorization;
  if (typeof cabecera === 'string' && cabecera.startsWith('Bearer ')) {
    const token = cabecera.slice('Bearer '.length).trim();
    if (token.length > 0) return token;
  }

  return null;
}

export function inicializarSocket(servidor: HttpServer): SocketServer {
  if (ioInstancia) return ioInstancia;

  const origenes =
    env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',').map((o) => o.trim());

  const io = new SocketServer(servidor, {
    cors: {
      origin: origenes,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    const token = extraerTokenHandshake(socket);
    if (!token) {
      next(new Error('NO_AUTENTICADO'));
      return;
    }

    try {
      const ctx = verificarAcceso(token);

      const usuario = await prisma.usuario.findUnique({
        where: { id: ctx.idUsuario },
        select: { estado: true, idPredio: true },
      });

      if (!usuario || usuario.estado !== 'HABILITADO' || usuario.idPredio !== ctx.idPredio) {
        next(new Error('USUARIO_INHABILITADO'));
        return;
      }

      (socket.data as SocketData).ctx = ctx;
      next();
    } catch (e) {
      if (e instanceof ErrorNoAutenticado) {
        next(new Error(e.codigo));
        return;
      }
      next(new Error('TOKEN_INVALIDO'));
    }
  });

  io.on('connection', (socket) => {
    const ctx = (socket.data as SocketData).ctx;
    if (!ctx) {
      socket.disconnect(true);
      return;
    }

    void socket.join(salaPredio(ctx.idPredio));
    void socket.join(salaUsuario(ctx.idUsuario));

    logger.debug(
      { socketId: socket.id, idUsuario: ctx.idUsuario, idPredio: ctx.idPredio, rol: ctx.rol },
      'Cliente conectado a Socket.IO',
    );

    socket.on('disconnect', (razon) => {
      logger.debug(
        { socketId: socket.id, idUsuario: ctx.idUsuario, razon },
        'Cliente desconectado de Socket.IO',
      );
    });
  });

  ioInstancia = io;
  return io;
}

export function emitirAPredio(idPredio: string, evento: EventoAlertaWs, payload: unknown): void {
  if (!ioInstancia) return;
  ioInstancia.to(salaPredio(idPredio)).emit(evento, payload);
}

/** Cierra todos los sockets activos de un usuario (p. ej. al inhabilitarlo en RF_22). */
export function desconectarUsuario(idUsuario: string): void {
  if (!ioInstancia) return;
  ioInstancia.in(salaUsuario(idUsuario)).disconnectSockets(true);
}

export async function cerrarSocket(): Promise<void> {
  if (!ioInstancia) return;
  const io = ioInstancia;
  ioInstancia = null;
  await new Promise<void>((resolver) => {
    io.close(() => resolver());
  });
}

export const emisorSocketPredio: EmisorAlertas = {
  emitirAPredio,
};
