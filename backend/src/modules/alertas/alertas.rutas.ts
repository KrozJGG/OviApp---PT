import { Router } from 'express';
import { autenticar } from '../../middleware/autenticar';
import { autenticarEdge } from '../../middleware/autenticarEdge';
import { soloProductor } from '../../middleware/autorizar';
import * as controlador from './alertas.controlador';

/**
 * Modulo 6 - Vigilancia y monitoreo de conteo (IF2-SAL).
 *
 * El modelo de vision por computadora corre en el dispositivo edge: aqui se
 * recibe el latido con el conteo actual de ovejas (IF5-ENT), se expone el
 * estado operativo del dispositivo a la app y se administra su Region de
 * Interes (ROI).
 */

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/edge - ingesta y configuracion del modulo de deteccion (API key)
// ─────────────────────────────────────────────────────────────────────────────
export const enrutadorEdge = Router();

enrutadorEdge.use(autenticarEdge);

// Latido de presencia; alimenta el indicador "en linea" y ultimo conteo de IF2-SAL.
enrutadorEdge.post('/heartbeat', controlador.heartbeat);

// Aviso de apagado limpio: pasa a "sin senal" de inmediato en vez de esperar
// a que venza MINUTOS_EN_LINEA. Solo cubre SIGTERM/SIGINT, no un SIGKILL.
enrutadorEdge.post('/desconexion', controlador.desconexion);

// Configuracion activa del dispositivo (ROI vigente o null para imagen completa).
enrutadorEdge.get('/configuracion', controlador.configuracionEdge);

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/vigilancia - estado del monitoreo y configuracion de ROI (JWT)
// ─────────────────────────────────────────────────────────────────────────────
export const enrutadorVigilancia = Router();

enrutadorVigilancia.use(autenticar);

// IF2-SAL - Productor y Trabajador.
enrutadorVigilancia.get('/estado', controlador.estado);

// Region de Interes - solo Productor (coherente con eventos y administracion).
enrutadorVigilancia.put('/dispositivos/:id/roi', soloProductor, controlador.guardarRoi);
enrutadorVigilancia.delete('/dispositivos/:id/roi', soloProductor, controlador.eliminarRoi);
