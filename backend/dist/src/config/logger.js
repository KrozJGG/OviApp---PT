"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const env_1 = require("./env");
exports.logger = (0, pino_1.default)({
    level: env_1.esTest ? 'silent' : env_1.env.LOG_LEVEL,
    // JSON plano en produccion (lo recoge el agregador de logs) y en tests (el
    // transporte de pino-pretty corre en un worker aparte que la suite no
    // necesita levantar). Salida legible solo en desarrollo.
    ...(env_1.esProduccion || env_1.esTest
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
//# sourceMappingURL=logger.js.map