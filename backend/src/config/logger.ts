import pino from 'pino';
import { env, esProduccion, esTest } from './env';

export const logger = pino({
  level: esTest ? 'silent' : env.LOG_LEVEL,
  // JSON plano en produccion (lo recoge el agregador de logs) y en tests (el
  // transporte de pino-pretty corre en un worker aparte que la suite no
  // necesita levantar). Salida legible solo en desarrollo.
  ...(esProduccion || esTest
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-edge-key"]',
      'req.body.password',
      'req.body.passwordActual',
      'req.body.passwordNueva',
      'res.headers["set-cookie"]',
    ],
    censor: '[oculto]',
  },
});

export type Logger = typeof logger;
