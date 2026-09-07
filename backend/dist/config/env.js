"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esTest = exports.esProduccion = exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
/**
 * Configuracion del proceso, validada al arrancar.
 * Si falta o es invalida una variable el servidor no levanta: es preferible
 * fallar en el arranque que descubrirlo en la primera peticion.
 */
const esquemaEnv = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(3000),
    DATABASE_URL: zod_1.z.string().min(1, 'DATABASE_URL es obligatoria'),
    // Conexiones simultaneas del pool de `pg`. El sistema esta dimensionado para
    // 3 a 5 usuarios concurrentes por predio (restriccion (e) del capitulo 3), asi
    // que el techo por defecto de la libreria sobra; se deja configurable para
    // poder ajustarlo al plan del proveedor de base de datos.
    DB_POOL_MAX: zod_1.z.coerce.number().int().positive().max(100).default(10),
    // RNF_03 - firma de los tokens de sesion.
    JWT_SECRET: zod_1.z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
    JWT_ACCESS_TTL: zod_1.z.string().default('15m'),
    JWT_REFRESH_TTL_DIAS: zod_1.z.coerce.number().int().positive().default(30),
    BCRYPT_ROUNDS: zod_1.z.coerce.number().int().min(4).max(15).default(12),
    // Origenes permitidos para CORS, separados por coma. '*' en desarrollo.
    CORS_ORIGINS: zod_1.z.string().default('*'),
    LOG_LEVEL: zod_1.z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    // Notificaciones push (RF_18). Si falta la credencial el envio queda inactivo
    // y solo se registra en el log: el resto del sistema sigue funcionando.
    FIREBASE_CREDENCIALES_JSON: zod_1.z.string().optional(),
    PUSH_HABILITADO: zod_1.z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
    // Recordatorios de eventos y tareas (IF4-SAL).
    CRON_RECORDATORIOS: zod_1.z.string().default('0 8 * * *'),
    CRON_HABILITADO: zod_1.z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
});
const resultado = esquemaEnv.safeParse(process.env);
if (!resultado.success) {
    const detalle = resultado.error.issues
        .map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`)
        .join('\n');
    throw new Error(`Configuracion de entorno invalida:\n${detalle}`);
}
exports.env = resultado.data;
exports.esProduccion = exports.env.NODE_ENV === 'production';
exports.esTest = exports.env.NODE_ENV === 'test';
//# sourceMappingURL=env.js.map