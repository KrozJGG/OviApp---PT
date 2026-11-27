import http, { type Server } from 'node:http';
import { crearApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { cerrarPrisma } from './config/prisma';
import { iniciarRecordatorios } from './modules/notificaciones/recordatorios';
import { cerrarSocket, inicializarSocket } from './realtime/socket';

const app = crearApp();
const servidor: Server = http.createServer(app);
inicializarSocket(servidor);

servidor.listen(env.PORT, () => {
  logger.info(`OviApp API + Socket.IO escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// IF4-SAL - recordatorios de eventos y tareas proximas.
const detenerRecordatorios = iniciarRecordatorios();

async function apagar(senal: string): Promise<void> {
  logger.info(`Recibido ${senal}, cerrando...`);
  detenerRecordatorios();
  await cerrarSocket();
  servidor.close(async () => {
    await cerrarPrisma();
    process.exit(0);
  });
  // Si alguna conexion queda colgada, no se espera indefinidamente.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void apagar('SIGTERM'));
process.on('SIGINT', () => void apagar('SIGINT'));
