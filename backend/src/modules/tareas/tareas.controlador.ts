import type { Request, Response } from 'express';
import { ctxDe } from '../../shared/contexto';
import { paginar } from '../../shared/paginacion';
import { esquemaParamId, validarCuerpo, validarParams, validarQuery } from '../../shared/validacion';
import {
  esquemaCrearTarea,
  esquemaEditarTarea,
  esquemaListadoTareas,
} from './tareas.esquemas';
import {
  completarTarea,
  crearTarea,
  editarTarea,
  eliminarTarea,
  listarTareas,
  obtenerTarea,
  type TareaCompleta,
} from './tareas.servicio';

/**
 * Modulo 4 - Planificacion de actividades (RF_11 a RF_14).
 * Aqui solo vive el parseo de la peticion y la forma de la respuesta; las
 * reglas de negocio estan en `tareas.servicio.ts`.
 */

/** POST /tareas - RF_11 */
export async function crear(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const datos = validarCuerpo(esquemaCrearTarea, req);
  res.status(201).json(aDto(await crearTarea(ctx, datos)));
}

/** GET /tareas - listado del predio */
export async function listar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const filtros = validarQuery(esquemaListadoTareas, req);
  const { filas, total } = await listarTareas(ctx, filtros);
  res.json(paginar(filas.map(aDto), total, filtros));
}

/** GET /tareas/:id */
export async function obtener(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);
  res.json(aDto(await obtenerTarea(ctx, id)));
}

/** PATCH /tareas/:id - RF_12 */
export async function editar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);
  const datos = validarCuerpo(esquemaEditarTarea, req);
  res.json(aDto(await editarTarea(ctx, id, datos)));
}

/** POST /tareas/:id/completar - RF_13 */
export async function completar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);
  res.json(aDto(await completarTarea(ctx, id)));
}

/** DELETE /tareas/:id - RF_14 */
export async function eliminar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { id } = validarParams(esquemaParamId, req);
  await eliminarTarea(ctx, id);
  res.status(204).end();
}

function aDto(t: TareaCompleta) {
  return {
    id: t.id,
    titulo: t.titulo,
    descripcion: t.descripcion,
    fechaLimite: t.fechaLimite,
    estado: t.estado,
    completadaEn: t.completadaEn,
    creador: t.creador,
    completadaPor: t.completadaPor,
    responsables: t.responsables.map((r) => r.usuario),
    animales: t.animales.map((a) => a.animal),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
