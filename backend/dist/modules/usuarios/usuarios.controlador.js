"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crear = crear;
exports.listar = listar;
exports.obtener = obtener;
exports.editar = editar;
exports.inhabilitar = inhabilitar;
const contexto_1 = require("../../shared/contexto");
const validacion_1 = require("../../shared/validacion");
const usuarios_esquemas_1 = require("./usuarios.esquemas");
const usuarios_servicio_1 = require("./usuarios.servicio");
/**
 * Modulo 7 - Administracion (RF_20, RF_21, RF_22).
 *
 * El controlador solo traduce HTTP: valida la entrada, saca el predio del token
 * y delega en el servicio, donde viven las reglas de los requerimientos.
 */
/** POST /usuarios - RF_20 */
async function crear(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const datos = (0, validacion_1.validarCuerpo)(usuarios_esquemas_1.esquemaCrearUsuario, req);
    res.status(201).json(await (0, usuarios_servicio_1.crearUsuario)(ctx.idPredio, datos));
}
/** GET /usuarios - listado del predio */
async function listar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const filtros = (0, validacion_1.validarQuery)(usuarios_esquemas_1.esquemaListarUsuarios, req);
    res.json(await (0, usuarios_servicio_1.listarUsuarios)(ctx.idPredio, filtros));
}
/** GET /usuarios/:id */
async function obtener(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    res.json(await (0, usuarios_servicio_1.obtenerUsuario)(ctx.idPredio, id));
}
/** PATCH /usuarios/:id - RF_21 */
async function editar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    // Se comprueba contra el cuerpo crudo: el esquema descarta las claves que no
    // conoce, asi que un `id` colado pasaria inadvertido.
    (0, usuarios_servicio_1.verificarIdentificadorInmutable)(req.body);
    const datos = (0, validacion_1.validarCuerpo)(usuarios_esquemas_1.esquemaEditarUsuario, req);
    res.json(await (0, usuarios_servicio_1.editarUsuario)(ctx.idPredio, id, datos));
}
/** POST /usuarios/:id/inhabilitar - RF_22 */
async function inhabilitar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    res.json(await (0, usuarios_servicio_1.inhabilitarUsuario)(ctx.idPredio, ctx.idUsuario, id));
}
//# sourceMappingURL=usuarios.controlador.js.map