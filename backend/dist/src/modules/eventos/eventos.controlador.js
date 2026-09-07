"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crear = crear;
exports.listar = listar;
exports.detalle = detalle;
exports.editar = editar;
exports.eliminar = eliminar;
const contexto_1 = require("../../shared/contexto");
const validacion_1 = require("../../shared/validacion");
const eventos_esquemas_1 = require("./eventos.esquemas");
const eventos_servicio_1 = require("./eventos.servicio");
/** POST /eventos - RF_07 Registrar evento (solo Productor). */
async function crear(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const datos = (0, validacion_1.validarCuerpo)(eventos_esquemas_1.esquemaCrearEvento, req);
    res.status(201).json(await (0, eventos_servicio_1.crearEvento)(ctx, datos));
}
/** GET /eventos - listado del calendario (ambos roles). */
async function listar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const filtros = (0, validacion_1.validarQuery)(eventos_esquemas_1.esquemaListadoEventos, req);
    res.json(await (0, eventos_servicio_1.listarEventos)(ctx, filtros));
}
/** GET /eventos/:id - RF_08 Consultar detalle (ambos roles). */
async function detalle(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    res.json(await (0, eventos_servicio_1.obtenerEvento)(ctx, id));
}
/**
 * PATCH /eventos/:id - RF_09 Editar evento (solo Productor).
 *
 * El tipo se busca sobre el cuerpo crudo, antes de validar: enviarlo no es un
 * error de formato sino un intento de cambiar un dato inmutable, y RF_09 pide
 * distinguirlo con su propio codigo (409) y no con un 400 generico.
 */
async function editar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    const intentaCambiarTipo = typeof req.body === 'object' && req.body !== null && 'tipo' in req.body;
    const datos = (0, validacion_1.validarCuerpo)(eventos_esquemas_1.esquemaEditarEvento, req);
    res.json(await (0, eventos_servicio_1.editarEvento)(ctx, id, datos, { intentaCambiarTipo }));
}
/** DELETE /eventos/:id - RF_10 Eliminar evento (solo Productor). */
async function eliminar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    await (0, eventos_servicio_1.eliminarEvento)(ctx, id);
    res.status(204).end();
}
//# sourceMappingURL=eventos.controlador.js.map