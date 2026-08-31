import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { ErrorNoAutenticado } from '../shared/errores';
import type { ContextoUsuario } from '../shared/contexto';

/** Contenido del access token. `predio` viaja aqui y nunca en el cuerpo. */
const esquemaPayload = z.object({
  sub: z.uuid(),
  predio: z.uuid(),
  rol: z.enum(['PRODUCTOR', 'TRABAJADOR']),
  email: z.string(),
});

export type PayloadAcceso = z.infer<typeof esquemaPayload>;

export function firmarAcceso(ctx: ContextoUsuario): string {
  const payload: PayloadAcceso = {
    sub: ctx.idUsuario,
    predio: ctx.idPredio,
    rol: ctx.rol,
    email: ctx.email,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function verificarAcceso(token: string): ContextoUsuario {
  let bruto: unknown;
  try {
    bruto = jwt.verify(token, env.JWT_SECRET);
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) {
      throw new ErrorNoAutenticado('TOKEN_EXPIRADO', 'Tu sesion expiro. Vuelve a iniciar sesion.');
    }
    throw new ErrorNoAutenticado('TOKEN_INVALIDO', 'La sesion no es valida.');
  }

  const r = esquemaPayload.safeParse(bruto);
  if (!r.success) {
    throw new ErrorNoAutenticado('TOKEN_INVALIDO', 'La sesion no es valida.');
  }

  return {
    idUsuario: r.data.sub,
    idPredio: r.data.predio,
    rol: r.data.rol,
    email: r.data.email,
  };
}

/**
 * Exige un access token valido y deja la identidad en `req.ctx`.
 * A partir de aqui, todo repositorio filtra por `ctx.idPredio` (RNF_08).
 */
export function autenticar(req: Request, _res: Response, next: NextFunction): void {
  const cabecera = req.header('authorization');
  if (!cabecera?.startsWith('Bearer ')) {
    next(new ErrorNoAutenticado('NO_AUTENTICADO', 'Debes iniciar sesion.'));
    return;
  }

  try {
    req.ctx = verificarAcceso(cabecera.slice('Bearer '.length).trim());
    next();
  } catch (e) {
    next(e);
  }
}
