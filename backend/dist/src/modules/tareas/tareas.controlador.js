"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crear = crear;
exports.listar = listar;
exports.obtener = obtener;
exports.editar = editar;
exports.completar = completar;
exports.eliminar = eliminar;
const contexto_1 = require("../../shared/contexto");
const paginacion_1 = require("../../shared/paginacion");
const validacion_1 = require("../../shared/validacion");
const tareas_esquemas_1 = require("./tareas.esquemas");
const tareas_servicio_1 = require("./tareas.servicio");
/**
 * Modulo 4 - Planificacion de actividades (RF_11 a RF_14).
 * Aqui solo vive el parseo de la peticion y la forma de la respuesta; las
 * reglas de negocio estan en `tareas.servicio.ts`.
 */
/** POST /tareas - RF_11 */
async function crear(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const datos = (0, validacion_1.validarCuerpo)(tareas_esquemas_1.esquemaCrearTarea, req);
    res.status(201).json(aDto(await (0, tareas_servicio_1.crearTarea)(ctx, datos)));
}
/** GET /tareas - listado del predio */
async function listar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const filtros = (0, validacion_1.validarQuery)(tareas_esquemas_1.esquemaListadoTareas, req);
    const { filas, total } = await (0, tareas_servicio_1.listarTareas)(ctx, filtros);
    res.json((0, paginacion_1.paginar)(filas.map(aDto), total, filtros));
}
/** GET /tareas/:id */
async function obtener(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    res.json(aDto(await (0, tareas_servicio_1.obtenerTarea)(ctx, id)));
}
/** PATCH /tareas/:id - RF_12 */
async function editar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    const datos = (0, validacion_1.validarCuerpo)(tareas_esquemas_1.esquemaEditarTarea, req);
    res.json(aDto(await (0, tareas_servicio_1.editarTarea)(ctx, id, datos)));
}
/** POST /tareas/:id/completar - RF_13 */
async function completar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    res.json(aDto(await (0, tareas_servicio_1.completarTarea)(ctx, id)));
}
/** DELETE /tareas/:id - RF_14 */
async function eliminar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    await (0, tareas_servicio_1.eliminarTarea)(ctx, id);
    res.status(204).end();
}
function aDto(t) {
    return {
        id: t.id,
        titulo: t.titulo,
        descripcion: t.descripcion,
        fechaLimite: t.fechaLimite,
        estado: t.estado,
        completadaEn: t.completadaEn,
        creador: t.creador,
        completadaPor: t.completadaPor,
        responsables: t.responsables.map((r) => r.usuario),
        animales: t.animales.map((a) => a.animal),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
    };
}
//# sourceMappingURL=tareas.controlador.js.map