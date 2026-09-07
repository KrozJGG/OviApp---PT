"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrutadorAgenda = exports.enrutadorInicio = void 0;
const express_1 = require("express");
const autenticar_1 = require("../../middleware/autenticar");
const agenda_controlador_1 = require("./agenda.controlador");
/**
 * Modulo 5 - Pantalla de inicio y calendario (RF_15, RF_16).
 *
 * Son dos enrutadores con prefijo propio y no uno solo montado en la raiz de la
 * API: un router montado en `/` con `use(autenticar)` a nivel de router se
 * convierte en una puerta de autenticacion para todo lo que se monte despues,
 * incluida la ingesta del modulo edge, que se autentica por API key y no por
 * JWT (IF5-ENT). Con prefijos explicitos cada middleware queda acotado a su
 * propio recurso.
 *
 * Ambos roles consultan la agenda: el Trabajador necesita ver sus actividades
 * del dia igual que el Productor, asi que no hay restriccion por rol. El modulo
 * es de solo lectura y todo sale filtrado por el predio del token (RNF_08).
 */
// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/inicio - tarjetas del dashboard (mockup 02)
// ─────────────────────────────────────────────────────────────────────────────
exports.enrutadorInicio = (0, express_1.Router)();
exports.enrutadorInicio.use(autenticar_1.autenticar);
exports.enrutadorInicio.get('/resumen', agenda_controlador_1.resumenInicio);
// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/agenda - RF_15 (resumen del dia) y RF_16 (calendario general)
// ─────────────────────────────────────────────────────────────────────────────
exports.enrutadorAgenda = (0, express_1.Router)();
exports.enrutadorAgenda.use(autenticar_1.autenticar);
exports.enrutadorAgenda.get('/hoy', agenda_controlador_1.agendaDeHoy);
exports.enrutadorAgenda.get('/', agenda_controlador_1.agendaDelRango);
//# sourceMappingURL=agenda.rutas.js.map