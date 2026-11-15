import type { Request, Response } from 'express';
import { ctxDe, edgeDe } from '../../shared/contexto';
import { validarCuerpo } from '../../shared/validacion';
import { esquemaHeartbeat } from './alertas.esquemas';
import {
  desconectarDispositivo,
  estadoVigilancia,
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

/** GET /vigilancia/estado - IF2-SAL */
export async function estado(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);

  res.json(await estadoVigilancia(ctx.idPredio));
}
