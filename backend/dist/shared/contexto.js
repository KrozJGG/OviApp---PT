"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ctxDe = ctxDe;
exports.edgeDe = edgeDe;
exports.esProductor = esProductor;
const errores_1 = require("./errores");
/**
 * Devuelve el contexto del usuario autenticado.
 * Lanza si la ruta no paso por el middleware `autenticar`, lo que convierte un
 * olvido de configuracion en un error inmediato y no en una fuga de datos.
 */
function ctxDe(req) {
    if (!req.ctx) {
        throw new errores_1.ErrorNoAutenticado('NO_AUTENTICADO', 'Esta ruta requiere sesion iniciada.');
    }
    return req.ctx;
}
/** Devuelve el contexto del dispositivo edge autenticado por API key. */
function edgeDe(req) {
    if (!req.edge) {
        throw new errores_1.ErrorNoAutenticado('API_KEY_INVALIDA', 'Esta ruta requiere una API key de dispositivo.');
    }
    return req.edge;
}
function esProductor(ctx) {
    return ctx.rol === 'PRODUCTOR';
}
//# sourceMappingURL=contexto.js.map