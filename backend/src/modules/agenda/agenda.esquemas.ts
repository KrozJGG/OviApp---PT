import { z } from 'zod';

/**
 * Modulo 5 - Pantalla de inicio y calendario (RF_15, RF_16).
 *
 * RF_16 permite navegar el calendario al pasado y al futuro sin restriccion, asi
 * que aqui no hay tope de fecha minima ni maxima: lo unico acotado es el ANCHO
 * del rango, y esa validacion es una regla de negocio (422), no de formato.
 */
export const esquemaRangoAgenda = z.object({
  desde: z.iso.date('La fecha "desde" debe tener el formato AAAA-MM-DD.').optional(),
  hasta: z.iso.date('La fecha "hasta" debe tener el formato AAAA-MM-DD.').optional(),
});

export type RangoAgenda = z.infer<typeof esquemaRangoAgenda>;
