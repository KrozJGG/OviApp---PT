import type { Request, Response } from 'express';
import { ctxDe } from '../../shared/contexto';
import { validarQuery } from '../../shared/validacion';
import { esquemaRangoAgenda } from './agenda.esquemas';
import { obtenerAgendaDelDia, obtenerAgendaDelRango, obtenerResumenInicio } from './agenda.servicio';

/**
 * Modulo 5 - Pantalla de inicio y calendario (RF_15, RF_16).
 * Los controladores solo traducen HTTP: las reglas viven en `agenda.servicio`.
 */

/** GET /inicio/resumen - tarjetas de la pantalla de inicio (RF_15). */
export async function resumenInicio(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  res.json(await obtenerResumenInicio(ctx.idPredio));
}

/** GET /agenda/hoy - actividades del dia (RF_15). */
export async function agendaDeHoy(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  res.json(await obtenerAgendaDelDia(ctx.idPredio));
}

/** GET /agenda?desde=&hasta= - calendario general (RF_16). */
export async function agendaDelRango(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const filtros = validarQuery(esquemaRangoAgenda, req);
  res.json(await obtenerAgendaDelRango(ctx.idPredio, filtros));
}
