import type { Request, Response } from 'express';
import { ctxDe } from '../../shared/contexto';
import { validarCuerpo, validarParams, validarQuery } from '../../shared/validacion';
import { esquemaArchivoStream, esquemaQueryStream, esquemaTokenStreaming } from './streaming.esquemas';
import { autorizarStream, traerArchivoStream, verificarTokenStreaming } from './streaming.servicio';

/**
 * Controladores del proxy de video en vivo.
 * Solo parsean, delegan en el servicio y responden: las reglas viven alli.
 */

/** POST /streaming/token - el usuario autenticado pide ver la camara de su predio. */
export async function token(req: Request, res: Response): Promise<void> {
  // El predio sale del JWT, nunca del cuerpo (RNF_08).
  const ctx = ctxDe(req);
  const datos = validarCuerpo(esquemaTokenStreaming, req);

  res.json(await autorizarStream(datos.idDispositivo, ctx.idPredio));
}

/** GET /streaming/:pathName/:archivo - manifiesto o segmento de video. */
export async function archivo(req: Request, res: Response): Promise<void> {
  const { pathName, archivo: nombre } = validarParams(esquemaArchivoStream, req);
  const { token: acceso } = validarQuery(esquemaQueryStream, req);

  verificarTokenStreaming(acceso, pathName);

  const resultado = await traerArchivoStream(pathName, nombre, acceso, consultaDeMediamtx(req));

  if (resultado.tipo === 'playlist') {
    // Un manifiesto en vivo cambia cada pocos segundos: cachearlo congela la emision.
    res.setHeader('Cache-Control', 'no-store');
    res.type('application/vnd.apple.mpegurl').send(resultado.contenido);
    return;
  }

  res.type(resultado.contentType).send(resultado.contenido);
}

/**
 * Parametros que hay que devolverle a MediaMTX tal cual vinieron.
 *
 * Son los que el propio MediaMTX escribio en el manifiesto (`session`); el
 * unico que se descarta es `token`, que es de este proxy y alli no significa
 * nada.
 */
function consultaDeMediamtx(req: Request): Record<string, string> {
  const consulta: Record<string, string> = {};

  for (const [clave, valor] of Object.entries(req.query)) {
    if (clave !== 'token' && typeof valor === 'string') consulta[clave] = valor;
  }

  return consulta;
}
