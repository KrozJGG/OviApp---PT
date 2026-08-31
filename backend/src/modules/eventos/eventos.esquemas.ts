import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/paginacion';

/**
 * Modulo 3 - Organizador de eventos (RF_07 a RF_10).
 *
 * `idAnimales` se valida aqui solo en su forma (uuid); que la lista no venga
 * vacia y que todos los animales esten activos son reglas de negocio y viven en
 * el servicio, porque RF_07 exige responder 422 con un codigo propio y no un
 * 400 generico de formato.
 */

export const TIPOS_EVENTO = ['ENCASTE', 'ESQUILA', 'ATENCION_SANITARIA', 'OTRO'] as const;
export const ESTADOS_EVENTO = ['PROGRAMADO', 'REALIZADO', 'ELIMINADO'] as const;

const descripcion = z
  .string()
  .trim()
  .max(1000, 'La descripción no puede superar los 1000 caracteres.');

const idAnimales = z.array(z.uuid('Alguno de los animales seleccionados no es válido.'));

const fechaInicio = z.iso.datetime({
  offset: true,
  error: 'La fecha del evento no es válida.',
});

export const esquemaCrearEvento = z.object({
  tipo: z.enum(TIPOS_EVENTO, 'Selecciona un tipo de evento válido.'),
  descripcion: descripcion.optional(),
  fechaInicio,
  idAnimales,
});

export type DatosCrearEvento = z.infer<typeof esquemaCrearEvento>;

/**
 * RF_09 - el tipo no aparece aqui a proposito: es inmutable. Si el cliente lo
 * envia, el controlador lo detecta sobre el cuerpo crudo y responde 409.
 */
export const esquemaEditarEvento = z.object({
  descripcion: descripcion.nullable().optional(),
  fechaInicio: fechaInicio.optional(),
  idAnimales: idAnimales.optional(),
});

export type DatosEditarEvento = z.infer<typeof esquemaEditarEvento>;

/** Booleano que llega como texto en la query string. */
const banderaQuery = z
  .union([z.literal('true'), z.literal('false')])
  .optional()
  .transform((v) => v === 'true');

export const esquemaListadoEventos = esquemaPaginacion.extend({
  desde: z.iso.date('La fecha inicial del rango no es válida.').optional(),
  hasta: z.iso.date('La fecha final del rango no es válida.').optional(),
  tipo: z.enum(TIPOS_EVENTO, 'El tipo de evento no es válido.').optional(),
  estado: z.enum(ESTADOS_EVENTO, 'El estado del evento no es válido.').optional(),
  incluirEliminados: banderaQuery,
});

export type FiltrosListadoEventos = z.infer<typeof esquemaListadoEventos>;
