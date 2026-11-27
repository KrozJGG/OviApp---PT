import { z } from 'zod';

/**
 * Modulo 8 - Reportes y Paneles de Informacion (RF23, RF24).
 */
export const esquemaRangoReporte = z.object({
  desde: z.iso.date('La fecha "desde" debe tener el formato AAAA-MM-DD.').optional(),
  hasta: z.iso.date('La fecha "hasta" debe tener el formato AAAA-MM-DD.').optional(),
});

export const esquemaExportarReporte = esquemaRangoReporte.extend({
  formato: z.enum(['pdf', 'csv'], {
    error: 'El formato debe ser "pdf" o "csv".',
  }),
});

export type RangoReporte = z.infer<typeof esquemaRangoReporte>;
export type ExportarReporte = z.infer<typeof esquemaExportarReporte>;
