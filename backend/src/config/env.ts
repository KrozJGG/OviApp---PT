import 'dotenv/config';
import { z } from 'zod';

/**
 * Configuracion del proceso, validada al arrancar.
 * Si falta o es invalida una variable el servidor no levanta: es preferible
 * fallar en el arranque que descubrirlo en la primera peticion.
 */
const esquemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),

  // Conexiones simultaneas del pool de `pg`. El sistema esta dimensionado para
  // 3 a 5 usuarios concurrentes por predio (restriccion (e) del capitulo 3), asi
  // que el techo por defecto de la libreria sobra; se deja configurable para
  // poder ajustarlo al plan del proveedor de base de datos.
  DB_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),

  // RNF_03 - firma de los tokens de sesion.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DIAS: z.coerce.number().int().positive().default(30),

  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  // Origenes permitidos para CORS, separados por coma. '*' en desarrollo.
  CORS_ORIGINS: z.string().default('*'),

  // Servidor de streaming (MediaMTX) dentro de la red interna de Docker. Su
  // puerto no se publica al host a proposito: la unica via al video es el proxy
  // autenticado de /api/v1/streaming, que corre en este mismo backend.
  MEDIAMTX_URL_INTERNO: z.url('MEDIAMTX_URL_INTERNO debe ser una URL').default('http://mediamtx:8888'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Notificaciones push (RF_18). Si falta la credencial el envio queda inactivo
  // y solo se registra en el log: el resto del sistema sigue funcionando.
  FIREBASE_CREDENCIALES_JSON: z.string().optional(),
  PUSH_HABILITADO: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Recordatorios de eventos y tareas (IF4-SAL).
  CRON_RECORDATORIOS: z.string().default('0 8 * * *'),
  CRON_HABILITADO: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Alertas en tiempo real por falta de ovejas (CONTEO).
  ALERTA_HEARTBEATS_CONFIRMACION: z.coerce.number().int().min(1).max(20).default(3),
  ALERTA_HEARTBEATS_NORMALIZACION: z.coerce.number().int().min(1).max(20).default(2),
  ALERTA_RENOTIFICACION_SEG: z.coerce.number().int().min(5).max(3600).default(60),
});

const resultado = esquemaEnv.safeParse(process.env);

if (!resultado.success) {
  const detalle = resultado.error.issues
    .map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`)
    .join('\n');
  throw new Error(`Configuracion de entorno invalida:\n${detalle}`);
}

export const env = resultado.data;

export type Env = typeof env;

export const esProduccion = env.NODE_ENV === 'production';
export const esTest = env.NODE_ENV === 'test';
