import { Router } from 'express';
import { autenticar } from '../../middleware/autenticar';
import { agendaDeHoy, agendaDelRango, resumenInicio } from './agenda.controlador';

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
export const enrutadorInicio = Router();

enrutadorInicio.use(autenticar);

enrutadorInicio.get('/resumen', resumenInicio);

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/agenda - RF_15 (resumen del dia) y RF_16 (calendario general)
// ─────────────────────────────────────────────────────────────────────────────
export const enrutadorAgenda = Router();

enrutadorAgenda.use(autenticar);

enrutadorAgenda.get('/hoy', agendaDeHoy);
enrutadorAgenda.get('/', agendaDelRango);
