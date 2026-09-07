"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorApp = void 0;
exports.noEncontrado = noEncontrado;
exports.manejadorErrores = manejadorErrores;
const zod_1 = require("zod");
const logger_1 = require("../config/logger");
const env_1 = require("../config/env");
const errores_1 = require("../shared/errores");
Object.defineProperty(exports, "ErrorApp", { enumerable: true, get: function () { return errores_1.ErrorApp; } });
/** Ruta inexistente: se traduce al mismo 404 que un recurso ausente. */
function noEncontrado(_req, _res, next) {
    next(new errores_1.ErrorNoEncontrado('La direccion solicitada no existe.'));
}
/**
 * Traduce cualquier excepcion a la forma { error: { codigo, mensaje } }.
 *
 * Errores conocidos de Prisma:
 *   P2002 unicidad  -> 409  (el modulo suele capturarlo antes con un mensaje propio)
 *   P2025 no existe -> 404
 *   P2003 FK        -> 422
 */
function manejadorErrores(err, req, res, _next) {
    const traducido = traducir(err);
    if (traducido.status >= 500) {
        logger_1.logger.error({ err, ruta: req.originalUrl, metodo: req.method }, 'Error no controlado');
    }
    else {
        logger_1.logger.debug({ codigo: traducido.codigo, ruta: req.originalUrl, metodo: req.method }, traducido.mensaje);
    }
    const cuerpo = {
        error: {
            codigo: traducido.codigo,
            mensaje: traducido.mensaje,
            ...(traducido.detalles === undefined ? {} : { detalles: traducido.detalles }),
        },
    };
    res.status(traducido.status).json(cuerpo);
}
function traducir(err) {
    if ((0, errores_1.esErrorApp)(err)) {
        return { status: err.status, codigo: err.codigo, mensaje: err.message, detalles: err.detalles };
    }
    if (err instanceof zod_1.z.ZodError) {
        const e = new errores_1.ErrorValidacion('Hay campos invalidos.', err.issues.map((i) => ({ campo: i.path.join('.') || '(raiz)', mensaje: i.message })));
        return { status: e.status, codigo: e.codigo, mensaje: e.message, detalles: e.detalles };
    }
    const codigoPrisma = codigoDePrisma(err);
    if (codigoPrisma === 'P2002') {
        return { status: 409, codigo: 'CONFLICTO', mensaje: 'Ya existe un registro con esos datos.' };
    }
    if (codigoPrisma === 'P2025') {
        return { status: 404, codigo: 'NO_ENCONTRADO', mensaje: 'No se encontro el recurso solicitado.' };
    }
    if (codigoPrisma === 'P2003') {
        return {
            status: 422,
            codigo: 'REFERENCIA_INVALIDA',
            mensaje: 'Alguno de los registros referenciados no existe.',
        };
    }
    // JSON mal formado en el cuerpo: body-parser lo marca con `type`.
    if (typeof err === 'object' && err !== null && err.type === 'entity.parse.failed') {
        return { status: 400, codigo: 'VALIDACION', mensaje: 'El cuerpo de la peticion no es JSON valido.' };
    }
    return {
        status: 500,
        codigo: 'INTERNO',
        mensaje: env_1.esProduccion
            ? 'Ocurrio un error inesperado. Intentalo nuevamente.'
            : err instanceof Error
                ? err.message
                : 'Error desconocido.',
    };
}
function codigoDePrisma(err) {
    if (typeof err !== 'object' || err === null)
        return undefined;
    const c = err.code;
    return typeof c === 'string' && c.startsWith('P') ? c : undefined;
}
//# sourceMappingURL=manejadorErrores.js.map