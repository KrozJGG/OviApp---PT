import type { Request, Response } from 'express';
import { ctxDe, edgeDe } from '../../shared/contexto';
import { esquemaParamId, validarCuerpo, validarParams } from '../../shared/validacion';
import { esquemaHeartbeat, esquemaRegionInteres } from './alertas.esquemas';
import {
  actualizarRegionInteres,
  desconectarDispositivo,
  eliminarRegionInteres,
  estadoVigilancia,
  obtenerConfiguracionEdge,
  registrarHeartbeat,
} from './alertas.servicio';

/**
 * Controladores del Modulo 6 - Vigilancia y conteo de ovejas (IF2-SAL / IF5-ENT).
 * Solo parsean, delegan en el servicio y responden: las reglas viven alli.
 */

/** POST /edge/heartbeat - latido de presencia del dispositivo. */
export async function heartbeat(req: Request, res: Response): Promise<void> {
  const edge = edgeDe(req);
  const datos = validarCuerpo(esquemaHeartbeat, req);

  await registrarHeartbeat(edge.idDispositivo, datos);

  res.status(204).end();
}

/** POST /edge/desconexion - aviso de apagado limpio (SIGTERM/SIGINT) del dispositivo. */
export async function desconexion(req: Request, res: Response): Promise<void> {
  const edge = edgeDe(req);

  await desconectarDispositivo(edge.idDispositivo);

  res.status(204).end();
}

/** GET /edge/configuracion - entrega la ROI activa al modulo ia-engine. */
export async function configuracionEdge(req: Request, res: Response): Promise<void> {
  const edge = edgeDe(req);

  res.json(await obtenerConfiguracionEdge(edge.idDispositivo));
}

/** GET /vigilancia/estado - IF2-SAL */
export async function estado(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);

  res.json(await estadoVigilancia(ctx.idPredio));
}

/** PUT /vigilancia/dispositivos/:id/roi - guarda o reemplaza la Region de Interes. */
export async function guardarRoi(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);
  const datos = validarCuerpo(esquemaRegionInteres, req);

  res.json(await actualizarRegionInteres(id, ctx.idPredio, datos));
}

/** DELETE /vigilancia/dispositivos/:id/roi - elimina la Region de Interes (imagen completa). */
export async function eliminarRoi(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);

  await eliminarRegionInteres(id, ctx.idPredio);

  res.status(204).end();
}
