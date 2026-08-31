import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/paginacion';

/**
 * Esquemas del Modulo 6 - Vigilancia y deteccion (RF_17 a RF_19).
 *
 * El modelo de vision por computadora vive en el dispositivo edge: aqui solo se
 * valida la senal que emite (IF5-ENT). Ni el predio ni el dispositivo llegan por
 * el cuerpo, salen siempre del contexto autenticado (RNF_08).
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

/** POST /edge/alertas - IF5-ENT */
export const esquemaIngestaAlerta = z.object({
  tipoAlerta: z.enum(['CONTEO', 'DISPERSION', 'AMENAZA'], 'El tipo de alerta no es valido.'),
  conteoAnimales: conteo.optional(),
  conteoEsperado: conteo.optional(),
  nivel: z.enum(['INFO', 'ADVERTENCIA', 'CRITICA'], 'El nivel de la alerta no es valido.').optional(),
  descripcion: z.string().trim().max(500, 'La descripcion no puede superar los 500 caracteres.').optional(),
  timestamp: marcaDeTiempo,
});

export type DatosIngestaAlerta = z.infer<typeof esquemaIngestaAlerta>;

/** POST /edge/heartbeat - latido de presencia del dispositivo. */
export const esquemaHeartbeat = z.object({
  conteoActual: conteo.optional(),
  timestamp: marcaDeTiempo,
});

export type DatosHeartbeat = z.infer<typeof esquemaHeartbeat>;

/** GET /alertas - RF_19 (historial filtrable por fecha, tipo y estado). */
export const esquemaListadoAlertas = esquemaPaginacion.extend({
  desde: z.iso.date('La fecha "desde" debe tener el formato AAAA-MM-DD.').optional(),
  hasta: z.iso.date('La fecha "hasta" debe tener el formato AAAA-MM-DD.').optional(),
  tipo: z.enum(['CONTEO', 'DISPERSION', 'AMENAZA'], 'El tipo de alerta no es valido.').optional(),
  estado: z.enum(['NUEVA', 'REVISADA'], 'El estado de la alerta no es valido.').optional(),
});

export type FiltrosAlertas = z.infer<typeof esquemaListadoAlertas>;
