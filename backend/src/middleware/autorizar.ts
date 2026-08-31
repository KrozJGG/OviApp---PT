import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { RolUsuario } from '../generated/prisma/enums';
import { ctxDe } from '../shared/contexto';
import { ErrorProhibido } from '../shared/errores';

/**
 * Control de acceso por rol (RNF_03).
 *
 * Se aplica a nivel de ruta y no dentro del servicio, para que la matriz
 * rol x endpoint sea legible de un vistazo en el archivo de rutas y se pueda
 * contrastar con la Tabla 3.1 de la tesis.
 *
 *   router.post('/', autorizar('PRODUCTOR'), controlador.crear)
 */
export function autorizar(...roles: RolUsuario[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const ctx = ctxDe(req);
      if (!roles.includes(ctx.rol)) {
        next(
          new ErrorProhibido(
            roles.length === 1 && roles[0] === 'PRODUCTOR'
              ? 'Solo el Productor puede realizar esta accion.'
              : 'Tu rol no permite realizar esta accion.',
          ),
        );
        return;
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Atajo legible para las rutas exclusivas del Productor. */
export const soloProductor: RequestHandler = autorizar('PRODUCTOR');
