import { z } from 'zod';

/**
 * Esquemas del Modulo 6 - Vigilancia y conteo de ovejas (IF2-SAL / IF5-ENT).
 *
 * El modelo de vision por computadora vive en el dispositivo edge: aqui solo se
 * valida el latido con el conteo actual que emite. Ni el predio ni el
 * dispositivo llegan por el cuerpo, salen siempre del contexto autenticado (RNF_08).
 */

const conteo = z
  .number('Debe ser un numero entero.')
  .int('Debe ser un numero entero.')
  .min(0, 'No puede ser negativo.');

/** Marca de tiempo emitida por el dispositivo. Se acepta con 'Z' o con desfase. */
const marcaDeTiempo = z.iso.datetime({
  offset: true,
  message: 'La marca de tiempo debe venir en formato ISO 8601.',
});

/** POST /edge/heartbeat - latido de presencia y conteo actual del dispositivo. */
export const esquemaHeartbeat = z.object({
  conteoActual: conteo.optional(),
  timestamp: marcaDeTiempo,
});

export type DatosHeartbeat = z.infer<typeof esquemaHeartbeat>;
