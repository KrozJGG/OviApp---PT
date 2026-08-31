import { Router } from 'express';
import { autenticar } from '../../middleware/autenticar';
import { autenticarEdge } from '../../middleware/autenticarEdge';
import * as controlador from './alertas.controlador';

/**
 * Modulo 6 - Vigilancia y deteccion (RF_17 a RF_19).
 *
 * Son tres enrutadores porque conviven dos identidades distintas: el modulo
 * edge se autentica con su API key (IF5-ENT) y los usuarios con su JWT. Separar
 * los montajes evita que una ruta de consulta quede accesible con una API key
 * de dispositivo, o al reves.
 *
 * El modelo de vision por computadora corre en el dispositivo: aqui solo se
 * recibe la senal, se almacena, se notifica y se expone.
 */

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/edge - ingesta del modulo de deteccion (API key)
// ─────────────────────────────────────────────────────────────────────────────
export const enrutadorEdge = Router();

enrutadorEdge.use(autenticarEdge);

// RF_17 + RF_18 - almacena la alerta y notifica al predio. Idempotente.
enrutadorEdge.post('/alertas', controlador.ingestar);

// Latido de presencia; alimenta el indicador "en linea" de IF2-SAL.
enrutadorEdge.post('/heartbeat', controlador.heartbeat);

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/alertas - historial para la app (JWT)
// ─────────────────────────────────────────────────────────────────────────────
export const enrutadorAlertas = Router();

enrutadorAlertas.use(autenticar);

// RF_19 - Productor y Trabajador; siempre acotado al predio de la sesion.
enrutadorAlertas.get('/', controlador.listar);
enrutadorAlertas.get('/:id', controlador.detalle);
enrutadorAlertas.post('/:id/revisar', controlador.revisar);

// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/vigilancia - estado del monitoreo (JWT)
// ─────────────────────────────────────────────────────────────────────────────
export const enrutadorVigilancia = Router();

enrutadorVigilancia.use(autenticar);

// IF2-SAL - Productor y Trabajador.
enrutadorVigilancia.get('/estado', controlador.estado);
