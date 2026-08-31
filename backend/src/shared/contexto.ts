import type { Request } from 'express';
import type { RolUsuario } from '../generated/prisma/enums';
import { ErrorNoAutenticado } from './errores';

/**
 * Identidad del usuario autenticado, derivada del JWT.
 *
 * `idPredio` viaja en el token y NUNCA se acepta desde el cuerpo de la peticion:
 * es lo que implementa el aislamiento entre predios de RNF_08 y el filtro que
 * exige RF_19.
 */
export interface ContextoUsuario {
  idUsuario: string;
  idPredio: string;
  rol: RolUsuario;
  email: string;
}

/** Identidad de un dispositivo edge, derivada de su API key (IF5-ENT). */
export interface ContextoEdge {
  idDispositivo: string;
  idPredio: string;
  nombre: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx?: ContextoUsuario;
      edge?: ContextoEdge;
    }
  }
}

/**
 * Devuelve el contexto del usuario autenticado.
 * Lanza si la ruta no paso por el middleware `autenticar`, lo que convierte un
 * olvido de configuracion en un error inmediato y no en una fuga de datos.
 */
export function ctxDe(req: Request): ContextoUsuario {
  if (!req.ctx) {
    throw new ErrorNoAutenticado('NO_AUTENTICADO', 'Esta ruta requiere sesion iniciada.');
  }
  return req.ctx;
}

/** Devuelve el contexto del dispositivo edge autenticado por API key. */
export function edgeDe(req: Request): ContextoEdge {
  if (!req.edge) {
    throw new ErrorNoAutenticado('API_KEY_INVALIDA', 'Esta ruta requiere una API key de dispositivo.');
  }
  return req.edge;
}

export function esProductor(ctx: ContextoUsuario): boolean {
  return ctx.rol === 'PRODUCTOR';
}
