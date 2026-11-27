import type { Request, Response } from 'express';
import { ctxDe } from '../../shared/contexto';
import { validarQuery } from '../../shared/validacion';
import { esquemaExportarReporte, esquemaRangoReporte } from './reportes.esquemas';
import { generarCsvReporte, generarPdfReporte } from './reportes.exportador';
import * as servicio from './reportes.servicio';

/** GET /api/v1/reportes/resumen (RF23) */
export async function resumen(req: Request, res: Response): Promise<void> {
  const { idPredio } = ctxDe(req);
  const filtros = validarQuery(esquemaRangoReporte, req);
  const reporte = await servicio.obtenerResumenReporte(idPredio, filtros);
  res.json(reporte);
}

/** GET /api/v1/reportes/exportar?formato=pdf|csv (RF24 / IF4-SAL) */
export async function exportar(req: Request, res: Response): Promise<void> {
  const { idPredio } = ctxDe(req);
  const { desde, hasta, formato } = validarQuery(esquemaExportarReporte, req);
  const reporte = await servicio.obtenerResumenReporte(idPredio, { desde, hasta });

  const nombreArchivo = `oviapp-reporte-${reporte.periodo.desde}_a_${reporte.periodo.hasta}.${formato}`;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

  if (formato === 'pdf') {
    const buffer = generarPdfReporte(reporte);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);
    return;
  }

  const buffer = generarCsvReporte(reporte);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(buffer);
}
