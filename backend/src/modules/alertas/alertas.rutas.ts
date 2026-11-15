import { Router } from 'express';
import { autenticar } from '../../middleware/autenticar';
import { autenticarEdge } from '../../middleware/autenticarEdge';
import * as controlador from './alertas.controlador';

/**
 * Modulo 6 - Vigilancia y monitoreo de conteo (IF2-SAL).
 *
 * El modelo de vision por computadora corre en el dispositivo edge: aqui solo se
 * recibe el latido con el conteo actual de ovejas (IF5-ENT) y se expone el
 * estado operativo del dispositivo a la app.
 */

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/edge - ingesta del modulo de deteccion (API key)
// ─────────────────────────────────────────────────────────────────────────────
export const enrutadorEdge = Router();

enrutadorEdge.use(autenticarEdge);

// Latido de presencia; alimenta el indicador "en linea" y ultimo conteo de IF2-SAL.
enrutadorEdge.post('/heartbeat', controlador.heartbeat);

// Aviso de apagado limpio: pasa a "sin senal" de inmediato en vez de esperar
// a que venza MINUTOS_EN_LINEA. Solo cubre SIGTERM/SIGINT, no un SIGKILL.
enrutadorEdge.post('/desconexion', controlador.desconexion);

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/vigilancia - estado del monitoreo (JWT)
// ─────────────────────────────────────────────────────────────────────────────
export const enrutadorVigilancia = Router();

enrutadorVigilancia.use(autenticar);

// IF2-SAL - Productor y Trabajador.
enrutadorVigilancia.get('/estado', controlador.estado);
