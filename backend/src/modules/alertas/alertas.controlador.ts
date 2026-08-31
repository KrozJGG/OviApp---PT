import type { Request, Response } from 'express';
import { ctxDe, edgeDe } from '../../shared/contexto';
import { esquemaParamId, validarCuerpo, validarParams, validarQuery } from '../../shared/validacion';
import { esquemaHeartbeat, esquemaIngestaAlerta, esquemaListadoAlertas } from './alertas.esquemas';
import {
  estadoVigilancia,
  ingestarAlerta,
  listarAlertas,
  obtenerAlerta,
  registrarHeartbeat,
  revisarAlerta,
} from './alertas.servicio';

/**
 * Controladores del Modulo 6 - Vigilancia y deteccion (RF_17 a RF_19).
 * Solo parsean, delegan en el servicio y responden: las reglas viven alli.
 */

/** POST /edge/alertas - RF_17, RF_18, IF5-ENT */
export async function ingestar(req: Request, res: Response): Promise<void> {
  // El predio sale de la API key del dispositivo, nunca del cuerpo (RNF_08).
  const edge = edgeDe(req);
  const datos = validarCuerpo(esquemaIngestaAlerta, req);

  const resultado = await ingestarAlerta(edge, datos);

  // Un reintento del dispositivo es inofensivo: 200 en vez de 201 o de conflicto.
  res.status(resultado.duplicada ? 200 : 201).json(resultado);
}

/** POST /edge/heartbeat - latido de presencia del dispositivo. */
export async function heartbeat(req: Request, res: Response): Promise<void> {
  const edge = edgeDe(req);
  const datos = validarCuerpo(esquemaHeartbeat, req);

  await registrarHeartbeat(edge.idDispositivo, datos);

  res.status(204).end();
}

/** GET /alertas - RF_19 */
export async function listar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const filtros = validarQuery(esquemaListadoAlertas, req);

  res.json(await listarAlertas(ctx.idPredio, filtros));
}

/** GET /alertas/:id - RF_19, destino del deep-link de la push. */
export async function detalle(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);

  res.json(await obtenerAlerta(ctx.idPredio, id));
}

/** POST /alertas/:id/revisar */
export async function revisar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);

  res.json(await revisarAlerta(ctx.idPredio, ctx.idUsuario, id));
}

/** GET /vigilancia/estado - IF2-SAL */
export async function estado(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);

  res.json(await estadoVigilancia(ctx.idPredio));
}
