import type { Request, Response } from 'express';
import { ctxDe } from '../../shared/contexto';
import { esquemaParamId, validarCuerpo, validarParams, validarQuery } from '../../shared/validacion';
import {
  esquemaCrearEvento,
  esquemaEditarEvento,
  esquemaListadoEventos,
} from './eventos.esquemas';
import {
  crearEvento,
  editarEvento,
  eliminarEvento,
  listarEventos,
  obtenerEvento,
} from './eventos.servicio';

/** POST /eventos - RF_07 Registrar evento (solo Productor). */
export async function crear(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const datos = validarCuerpo(esquemaCrearEvento, req);
  res.status(201).json(await crearEvento(ctx, datos));
}

/** GET /eventos - listado del calendario (ambos roles). */
export async function listar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const filtros = validarQuery(esquemaListadoEventos, req);
  res.json(await listarEventos(ctx, filtros));
}

/** GET /eventos/:id - RF_08 Consultar detalle (ambos roles). */
export async function detalle(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);
  res.json(await obtenerEvento(ctx, id));
}

/**
 * PATCH /eventos/:id - RF_09 Editar evento (solo Productor).
 *
 * El tipo se busca sobre el cuerpo crudo, antes de validar: enviarlo no es un
 * error de formato sino un intento de cambiar un dato inmutable, y RF_09 pide
 * distinguirlo con su propio codigo (409) y no con un 400 generico.
 */
export async function editar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);
  const intentaCambiarTipo =
    typeof req.body === 'object' && req.body !== null && 'tipo' in req.body;
  const datos = validarCuerpo(esquemaEditarEvento, req);
  res.json(await editarEvento(ctx, id, datos, { intentaCambiarTipo }));
}

/** DELETE /eventos/:id - RF_10 Eliminar evento (solo Productor). */
export async function eliminar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);
  await eliminarEvento(ctx, id);
  res.status(204).end();
}
