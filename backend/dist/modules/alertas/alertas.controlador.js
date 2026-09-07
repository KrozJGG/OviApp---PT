"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestar = ingestar;
exports.heartbeat = heartbeat;
exports.listar = listar;
exports.detalle = detalle;
exports.revisar = revisar;
exports.estado = estado;
const contexto_1 = require("../../shared/contexto");
const validacion_1 = require("../../shared/validacion");
const alertas_esquemas_1 = require("./alertas.esquemas");
const alertas_servicio_1 = require("./alertas.servicio");
/**
 * Controladores del Modulo 6 - Vigilancia y deteccion (RF_17 a RF_19).
 * Solo parsean, delegan en el servicio y responden: las reglas viven alli.
 */
/** POST /edge/alertas - RF_17, RF_18, IF5-ENT */
async function ingestar(req, res) {
    // El predio sale de la API key del dispositivo, nunca del cuerpo (RNF_08).
    const edge = (0, contexto_1.edgeDe)(req);
    const datos = (0, validacion_1.validarCuerpo)(alertas_esquemas_1.esquemaIngestaAlerta, req);
    const resultado = await (0, alertas_servicio_1.ingestarAlerta)(edge, datos);
    // Un reintento del dispositivo es inofensivo: 200 en vez de 201 o de conflicto.
    res.status(resultado.duplicada ? 200 : 201).json(resultado);
}
/** POST /edge/heartbeat - latido de presencia del dispositivo. */
async function heartbeat(req, res) {
    const edge = (0, contexto_1.edgeDe)(req);
    const datos = (0, validacion_1.validarCuerpo)(alertas_esquemas_1.esquemaHeartbeat, req);
    await (0, alertas_servicio_1.registrarHeartbeat)(edge.idDispositivo, datos);
    res.status(204).end();
}
/** GET /alertas - RF_19 */
async function listar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const filtros = (0, validacion_1.validarQuery)(alertas_esquemas_1.esquemaListadoAlertas, req);
    res.json(await (0, alertas_servicio_1.listarAlertas)(ctx.idPredio, filtros));
}
/** GET /alertas/:id - RF_19, destino del deep-link de la push. */
async function detalle(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    res.json(await (0, alertas_servicio_1.obtenerAlerta)(ctx.idPredio, id));
}
/** POST /alertas/:id/revisar */
async function revisar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    res.json(await (0, alertas_servicio_1.revisarAlerta)(ctx.idPredio, ctx.idUsuario, id));
}
/** GET /vigilancia/estado - IF2-SAL */
async function estado(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    res.json(await (0, alertas_servicio_1.estadoVigilancia)(ctx.idPredio));
}
//# sourceMappingURL=alertas.controlador.js.map