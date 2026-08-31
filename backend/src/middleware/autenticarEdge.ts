import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ErrorNoAutenticado } from '../shared/errores';

/**
 * Autenticacion del modulo edge por API key (IF5-ENT).
 *
 * La key tiene la forma `<prefijo>.<secreto>`: el prefijo localiza el
 * dispositivo con un indice y el secreto se compara contra su hash bcrypt.
 * Asi la tabla no guarda nunca la key completa y la busqueda no requiere
 * recorrer todos los dispositivos.
 */
export const CABECERA_EDGE = 'x-edge-key';

export function partirApiKey(key: string): { prefijo: string; secreto: string } | null {
  const punto = key.indexOf('.');
  if (punto <= 0 || punto === key.length - 1) return null;
  return { prefijo: key.slice(0, punto), secreto: key.slice(punto + 1) };
}

export async function autenticarEdge(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const key = req.header(CABECERA_EDGE);
  if (!key) {
    next(new ErrorNoAutenticado('API_KEY_INVALIDA', 'Falta la API key del dispositivo.'));
    return;
  }

  const partes = partirApiKey(key);
  if (!partes) {
    next(new ErrorNoAutenticado('API_KEY_INVALIDA', 'La API key del dispositivo no es valida.'));
    return;
  }

  try {
    const dispositivo = await prisma.dispositivoEdge.findUnique({
      where: { apiKeyPrefijo: partes.prefijo },
    });

    if (!dispositivo || !(await bcrypt.compare(partes.secreto, dispositivo.apiKeyHash))) {
      next(new ErrorNoAutenticado('API_KEY_INVALIDA', 'La API key del dispositivo no es valida.'));
      return;
    }

    req.edge = {
      idDispositivo: dispositivo.id,
      idPredio: dispositivo.idPredio,
      nombre: dispositivo.nombre,
    };
    next();
  } catch (e) {
    next(e);
  }
}
