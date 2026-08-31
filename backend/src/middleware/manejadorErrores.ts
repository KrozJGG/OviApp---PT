import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../config/logger';
import { esProduccion } from '../config/env';
import { ErrorApp, ErrorNoEncontrado, ErrorValidacion, esErrorApp } from '../shared/errores';

/** Forma unica de error que consume la app movil. */
export interface CuerpoError {
  error: {
    codigo: string;
    mensaje: string;
    detalles?: unknown;
  };
}

/** Ruta inexistente: se traduce al mismo 404 que un recurso ausente. */
export function noEncontrado(_req: Request, _res: Response, next: NextFunction): void {
  next(new ErrorNoEncontrado('La direccion solicitada no existe.'));
}

/**
 * Traduce cualquier excepcion a la forma { error: { codigo, mensaje } }.
 *
 * Errores conocidos de Prisma:
 *   P2002 unicidad  -> 409  (el modulo suele capturarlo antes con un mensaje propio)
 *   P2025 no existe -> 404
 *   P2003 FK        -> 422
 */
export function manejadorErrores(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const traducido = traducir(err);

  if (traducido.status >= 500) {
    logger.error({ err, ruta: req.originalUrl, metodo: req.method }, 'Error no controlado');
  } else {
    logger.debug(
      { codigo: traducido.codigo, ruta: req.originalUrl, metodo: req.method },
      traducido.mensaje,
    );
  }

  const cuerpo: CuerpoError = {
    error: {
      codigo: traducido.codigo,
      mensaje: traducido.mensaje,
      ...(traducido.detalles === undefined ? {} : { detalles: traducido.detalles }),
    },
  };

  res.status(traducido.status).json(cuerpo);
}

interface ErrorTraducido {
  status: number;
  codigo: string;
  mensaje: string;
  detalles?: unknown;
}

function traducir(err: unknown): ErrorTraducido {
  if (esErrorApp(err)) {
    return { status: err.status, codigo: err.codigo, mensaje: err.message, detalles: err.detalles };
  }

  if (err instanceof z.ZodError) {
    const e = new ErrorValidacion('Hay campos invalidos.',
      err.issues.map((i) => ({ campo: i.path.join('.') || '(raiz)', mensaje: i.message })));
    return { status: e.status, codigo: e.codigo, mensaje: e.message, detalles: e.detalles };
  }

  const codigoPrisma = codigoDePrisma(err);
  if (codigoPrisma === 'P2002') {
    return { status: 409, codigo: 'CONFLICTO', mensaje: 'Ya existe un registro con esos datos.' };
  }
  if (codigoPrisma === 'P2025') {
    return { status: 404, codigo: 'NO_ENCONTRADO', mensaje: 'No se encontro el recurso solicitado.' };
  }
  if (codigoPrisma === 'P2003') {
    return {
      status: 422,
      codigo: 'REFERENCIA_INVALIDA',
      mensaje: 'Alguno de los registros referenciados no existe.',
    };
  }

  // JSON mal formado en el cuerpo: body-parser lo marca con `type`.
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    return { status: 400, codigo: 'VALIDACION', mensaje: 'El cuerpo de la peticion no es JSON valido.' };
  }

  return {
    status: 500,
    codigo: 'INTERNO',
    mensaje: esProduccion
      ? 'Ocurrio un error inesperado. Intentalo nuevamente.'
      : err instanceof Error
        ? err.message
        : 'Error desconocido.',
  };
}

function codigoDePrisma(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const c = (err as { code?: unknown }).code;
  return typeof c === 'string' && c.startsWith('P') ? c : undefined;
}

export { ErrorApp };
