import type { Request, Response } from 'express';
import { ctxDe } from '../../shared/contexto';
import { validarCuerpo, validarParams, validarQuery, esquemaParamId } from '../../shared/validacion';
import {
  esquemaCrearUsuario,
  esquemaEditarUsuario,
  esquemaListarUsuarios,
} from './usuarios.esquemas';
import {
  crearUsuario,
  editarUsuario,
  inhabilitarUsuario,
  listarUsuarios,
  obtenerUsuario,
  verificarIdentificadorInmutable,
} from './usuarios.servicio';

/**
 * Modulo 7 - Administracion (RF_20, RF_21, RF_22).
 *
 * El controlador solo traduce HTTP: valida la entrada, saca el predio del token
 * y delega en el servicio, donde viven las reglas de los requerimientos.
 */

/** POST /usuarios - RF_20 */
export async function crear(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const datos = validarCuerpo(esquemaCrearUsuario, req);

  res.status(201).json(await crearUsuario(ctx.idPredio, datos));
}

/** GET /usuarios - listado del predio */
export async function listar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const filtros = validarQuery(esquemaListarUsuarios, req);

  res.json(await listarUsuarios(ctx.idPredio, filtros));
}

/** GET /usuarios/:id */
export async function obtener(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);

  res.json(await obtenerUsuario(ctx.idPredio, id));
}

/** PATCH /usuarios/:id - RF_21 */
export async function editar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);

  // Se comprueba contra el cuerpo crudo: el esquema descarta las claves que no
  // conoce, asi que un `id` colado pasaria inadvertido.
  verificarIdentificadorInmutable(req.body);

  const datos = validarCuerpo(esquemaEditarUsuario, req);

  res.json(await editarUsuario(ctx.idPredio, id, datos));
}

/** POST /usuarios/:id/inhabilitar - RF_22 */
export async function inhabilitar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);

  res.json(await inhabilitarUsuario(ctx.idPredio, ctx.idUsuario, id));
}
