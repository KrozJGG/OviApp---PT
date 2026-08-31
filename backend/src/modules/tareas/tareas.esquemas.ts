import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/paginacion';

/**
 * Esquemas de Modulo 4 - Planificacion de actividades (RF_11 a RF_14).
 *
 * Aqui solo se valida el FORMATO (400). Las reglas de negocio -responsables
 * obligatorios, pertenencia al predio, fecha no pasada, tarea ya completada-
 * viven en `tareas.servicio.ts` y responden 422 / 404 / 409.
 *
 * En particular `idResponsables` NO lleva `.min(1)`: RF_11 exige "uno o mas
 * responsables" como regla de negocio, y el contrato le asigna el codigo
 * RESPONSABLES_REQUERIDOS con status 422, no un 400 de validacion.
 */

const titulo = z
  .string()
  .trim()
  .min(1, 'Escribe un título para la tarea.')
  .max(200, 'El título no puede superar los 200 caracteres.');

const descripcion = z
  .string()
  .trim()
  .max(1000, 'La descripción no puede superar los 1000 caracteres.')
  .nullable();

const fechaLimite = z.iso.date('La fecha de término debe tener el formato AAAA-MM-DD.');

const idResponsables = z.array(z.uuid('Alguno de los responsables no es válido.'));

const idAnimales = z.array(z.uuid('Alguno de los animales no es válido.'));

export const esquemaCrearTarea = z.object({
  titulo,
  descripcion: descripcion.optional(),
  fechaLimite,
  idResponsables,
  idAnimales: idAnimales.optional(),
});

export type DatosCrearTarea = z.infer<typeof esquemaCrearTarea>;

/**
 * RF_12 - edicion parcial. Cada campo ausente se deja como estaba; enviar
 * `idAnimales: []` si desvincula todos los animales.
 */
export const esquemaEditarTarea = z.object({
  titulo: titulo.optional(),
  descripcion: descripcion.optional(),
  fechaLimite: fechaLimite.optional(),
  idResponsables: idResponsables.optional(),
  idAnimales: idAnimales.optional(),
});

export type DatosEditarTarea = z.infer<typeof esquemaEditarTarea>;

export const esquemaListadoTareas = esquemaPaginacion.extend({
  estado: z.enum(['ACTIVA', 'COMPLETADA']).optional(),
  desde: z.iso.date('El filtro «desde» debe tener el formato AAAA-MM-DD.').optional(),
  hasta: z.iso.date('El filtro «hasta» debe tener el formato AAAA-MM-DD.').optional(),
  idResponsable: z.uuid('El responsable indicado no es válido.').optional(),
});

export type FiltrosTareas = z.infer<typeof esquemaListadoTareas>;
