import type { Request, Response } from 'express';
import { ctxDe } from '../../shared/contexto';
import { esquemaParamId, validarCuerpo, validarParams, validarQuery } from '../../shared/validacion';
import {
  esquemaBajaAnimal,
  esquemaCrearAnimal,
  esquemaEditarAnimal,
  esquemaListadoAnimales,
} from './animales.esquemas';
import * as servicio from './animales.servicio';

/**
 * Modulo 1 - Ficha Animal (RF_01 a RF_04).
 * El controlador solo valida la entrada y traduce el resultado a HTTP: las
 * reglas viven en `animales.servicio`.
 */

/** POST /animales - RF_01 */
export async function crear(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const datos = validarCuerpo(esquemaCrearAnimal, req);

  res.status(201).json(await servicio.crear(ctx, datos));
}

/** GET /animales - listado del rebano */
export async function listar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const filtros = validarQuery(esquemaListadoAnimales, req);

  res.json(await servicio.listar(ctx, filtros));
}

/** GET /animales/:id - RF_02 */
export async function obtener(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);

  res.json(await servicio.obtenerFicha(ctx, id));
}

/** PATCH /animales/:id - RF_03 */
export async function editar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);
  const datos = validarCuerpo(esquemaEditarAnimal, req);

  res.json(await servicio.editar(ctx, id, datos));
}

/** POST /animales/:id/baja - RF_04 */
export async function darDeBaja(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);
  const datos = validarCuerpo(esquemaBajaAnimal, req);

  res.json(await servicio.darDeBaja(ctx, id, datos));
}

/** DELETE /animales/:id - eliminacion definitiva (solo Productor) */
export async function eliminar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);

  await servicio.eliminar(ctx, id);
  res.status(204).end();
}
