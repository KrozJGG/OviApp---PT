"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumenInicio = resumenInicio;
exports.agendaDeHoy = agendaDeHoy;
exports.agendaDelRango = agendaDelRango;
const contexto_1 = require("../../shared/contexto");
const validacion_1 = require("../../shared/validacion");
const agenda_esquemas_1 = require("./agenda.esquemas");
const agenda_servicio_1 = require("./agenda.servicio");
/**
 * Modulo 5 - Pantalla de inicio y calendario (RF_15, RF_16).
 * Los controladores solo traducen HTTP: las reglas viven en `agenda.servicio`.
 */
/** GET /inicio/resumen - tarjetas de la pantalla de inicio (RF_15). */
async function resumenInicio(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    res.json(await (0, agenda_servicio_1.obtenerResumenInicio)(ctx.idPredio));
}
/** GET /agenda/hoy - actividades del dia (RF_15). */
async function agendaDeHoy(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    res.json(await (0, agenda_servicio_1.obtenerAgendaDelDia)(ctx.idPredio));
}
/** GET /agenda?desde=&hasta= - calendario general (RF_16). */
async function agendaDelRango(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const filtros = (0, validacion_1.validarQuery)(agenda_esquemas_1.esquemaRangoAgenda, req);
    res.json(await (0, agenda_servicio_1.obtenerAgendaDelRango)(ctx.idPredio, filtros));
}
//# sourceMappingURL=agenda.controlador.js.map