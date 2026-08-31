import type { Request } from 'express';
import { z } from 'zod';
import { ErrorValidacion } from './errores';

/**
 * Validacion con Zod dentro del controlador, en vez de como middleware.
 *
 * Es a proposito: `esquema.parse` devuelve el tipo inferido, asi que el
 * controlador trabaja con datos tipados sin castings ni propiedades magicas
 * colgadas del Request. Ademas, en Express 5 `req.query` es de solo lectura,
 * asi que un middleware no podria reemplazarla.
 */

export interface DetalleValidacion {
  campo: string;
  mensaje: string;
}

function aDetalles(error: z.ZodError): DetalleValidacion[] {
  return error.issues.map((i) => ({
    campo: i.path.length > 0 ? i.path.join('.') : '(raiz)',
    mensaje: i.message,
  }));
}

function validar<S extends z.ZodType>(esquema: S, valor: unknown, donde: string): z.infer<S> {
  const r = esquema.safeParse(valor);
  if (!r.success) {
    throw new ErrorValidacion(`Hay campos invalidos en ${donde}.`, aDetalles(r.error));
  }
  return r.data;
}

export function validarCuerpo<S extends z.ZodType>(esquema: S, req: Request): z.infer<S> {
  return validar(esquema, req.body, 'el formulario');
}

export function validarQuery<S extends z.ZodType>(esquema: S, req: Request): z.infer<S> {
  return validar(esquema, req.query, 'los filtros');
}

export function validarParams<S extends z.ZodType>(esquema: S, req: Request): z.infer<S> {
  return validar(esquema, req.params, 'la direccion solicitada');
}

/** Parametro de ruta `:id` como UUID. Reutilizado por todos los modulos. */
export const esquemaParamId = z.object({
  id: z.uuid('El identificador no es valido.'),
});
