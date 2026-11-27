import { Router } from 'express';
import { autenticar } from '../../middleware/autenticar';
import { autenticarEdge } from '../../middleware/autenticarEdge';
import { soloProductor } from '../../middleware/autorizar';
import * as controlador from './alertas.controlador';

/**
 * Modulo 6 - Vigilancia, monitoreo de conteo y alertas (IF2-SAL / RF_18 / RF_19).
 */

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/edge - ingesta y configuracion del modulo de deteccion (API key)
// ─────────────────────────────────────────────────────────────────────────────
export const enrutadorEdge = Router();

enrutadorEdge.use(autenticarEdge);

enrutadorEdge.post('/heartbeat', controlador.heartbeat);
enrutadorEdge.post('/desconexion', controlador.desconexion);
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

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/alertas - historial y gestion de estado de alertas (JWT)
// ─────────────────────────────────────────────────────────────────────────────
export const enrutadorAlertas = Router();

enrutadorAlertas.use(autenticar);

// Accesible para PRODUCTOR y TRABAJADOR del mismo predio.
enrutadorAlertas.get('/', controlador.listar);
enrutadorAlertas.patch('/:id/estado', controlador.actualizarEstado);
