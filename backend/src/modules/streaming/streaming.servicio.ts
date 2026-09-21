import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../shared/db';
import { ErrorNoAutenticado, ErrorNoEncontrado } from '../../shared/errores';

/**
 * Proxy autenticado del video en vivo (MediaMTX -> app).
 *
 * MediaMTX no tiene autenticacion propia y su puerto HLS no se publica al host,
 * asi que la unica via al video es este modulo. El problema a resolver es que
 * quien pide el manifiesto y cada segmento es el reproductor (ExoPlayer, AVPlayer
 * o hls.js), no el cliente HTTP de la app: esas peticiones no pasan por el
 * interceptor que adjunta el JWT de sesion. En iOS, ademas, AVPlayer no garantiza
 * reenviar cabeceras propias a las sub-peticiones de un HLS.
 *
 * Por eso el acceso va con un token corto en la query string, y al servir un
 * manifiesto se reescriben sus URIs para que arrastren ese mismo token. Es lo
 * unico que funciona igual en Android, iOS y navegador.
 */

/** Minutos de vida del token de video. La app lo renueva sola antes de que venza. */
export const MINUTOS_TOKEN_STREAMING = 10;

/**
 * Unico stream existente hoy, igual que en `RTSP_STREAMS` del compose y en
 * `paths:` de mediamtx.yml. Cuando haya mas de una camara, este literal pasa a
 * ser una columna de `dispositivo_edge` y se lee desde el dispositivo.
 */
const PATH_STREAM = 'rebano';

/** Marca que distingue este token del access token normal, firmado con el mismo secreto. */
const PROPOSITO = 'stream';

const esquemaPayloadStream = z.object({
  proposito: z.literal(PROPOSITO),
  pathName: z.string(),
  predio: z.uuid(),
});

export interface AccesoStream {
  /** Ruta relativa a la base de la API; la app la concatena a su propia URL base. */
  url: string;
  expiraEnSeg: number;
}

/**
 * Autoriza a un usuario a ver la camara de su predio y emite el token del video.
 *
 * Se puede llamar tantas veces como haga falta: no hay estado, cooldown ni
 * limite de tokens vivos. Cada entrada a la pantalla pide uno nuevo.
 */
export async function autorizarStream(idDispositivo: string, idPredio: string): Promise<AccesoStream> {
  // findFirst con ambos ids: un dispositivo de otro predio responde igual que
  // uno inexistente, sin revelar que existe (RNF_08).
  const dispositivo = await prisma.dispositivoEdge.findFirst({
    where: { id: idDispositivo, idPredio },
    select: { id: true },
  });

  if (!dispositivo) {
    throw new ErrorNoEncontrado('No se encontro la camara solicitada.');
  }

  const token = jwt.sign(
    { proposito: PROPOSITO, pathName: PATH_STREAM, predio: idPredio },
    env.JWT_SECRET,
    { expiresIn: `${MINUTOS_TOKEN_STREAMING}m` },
  );

  return {
    url: `/streaming/${PATH_STREAM}/index.m3u8?token=${encodeURIComponent(token)}`,
    expiraEnSeg: MINUTOS_TOKEN_STREAMING * 60,
  };
}

/**
 * Valida el token del video contra el stream que se esta pidiendo.
 *
 * El access token normal no sirve aqui (no lleva `proposito`) y este tampoco
 * sirve como access token (no lleva `sub`, `rol` ni `email`, que es lo que exige
 * `verificarAcceso`): comparten secreto pero no son intercambiables.
 */
export function verificarTokenStreaming(token: string, pathName: string): void {
  let bruto: unknown;
  try {
    bruto = jwt.verify(token, env.JWT_SECRET);
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) {
      throw new ErrorNoAutenticado('TOKEN_EXPIRADO', 'El acceso al video expiro.');
    }
    throw new ErrorNoAutenticado('TOKEN_INVALIDO', 'El acceso al video no es valido.');
  }

  const r = esquemaPayloadStream.safeParse(bruto);
  if (!r.success || r.data.pathName !== pathName) {
    throw new ErrorNoAutenticado('TOKEN_INVALIDO', 'El acceso al video no es valido.');
  }
}

export type ArchivoStream =
  | { tipo: 'playlist'; contenido: string }
  | { tipo: 'binario'; contenido: Buffer; contentType: string };

/**
 * Trae de MediaMTX el manifiesto o el segmento pedido.
 *
 * Los segmentos se leen enteros en memoria en vez de encadenar streams: duran
 * uno o dos segundos de video y el sistema esta dimensionado para 3 a 5 usuarios
 * concurrentes por predio, asi que no justifica la complejidad de convertir el
 * cuerpo web a un stream de Node.
 */
export async function traerArchivoStream(
  pathName: string,
  archivo: string,
  token: string,
  consultaUpstream: Record<string, string> = {},
): Promise<ArchivoStream> {
  const destino = new URL(`${env.MEDIAMTX_URL_INTERNO}/${pathName}/${archivo}`);

  // MediaMTX cuelga sus propios parametros de las URIs que escribe en el
  // manifiesto (`session`, que ata la peticion al muxer). Si no se le devuelven,
  // responde 404 y la reproduccion no llega a arrancar.
  for (const [clave, valor] of Object.entries(consultaUpstream)) {
    destino.searchParams.set(clave, valor);
  }

  const url = destino.toString();

  let respuesta: Response;
  try {
    respuesta = await fetch(url);
  } catch (e) {
    // MediaMTX caido o inalcanzable. Para la app es lo mismo que no haber video.
    logger.warn({ err: e, url }, 'No se pudo contactar al servidor de streaming');
    throw new ErrorNoEncontrado(
      'La camara no esta transmitiendo en este momento.',
      'STREAM_NO_DISPONIBLE',
    );
  }

  if (!respuesta.ok) {
    logger.debug({ url, status: respuesta.status }, 'El servidor de streaming rechazo la peticion');
    throw new ErrorNoEncontrado(
      'La camara no esta transmitiendo en este momento.',
      'STREAM_NO_DISPONIBLE',
    );
  }

  if (archivo.endsWith('.m3u8')) {
    return { tipo: 'playlist', contenido: reescribirPlaylist(await respuesta.text(), token) };
  }

  return {
    tipo: 'binario',
    contenido: Buffer.from(await respuesta.arrayBuffer()),
    contentType: respuesta.headers.get('content-type') ?? 'application/octet-stream',
  };
}

/**
 * Reescribe un manifiesto HLS para que cada archivo al que apunta lleve el token.
 *
 * Hacen falta los dos casos: las lineas sueltas (segmentos y sub-playlists) y
 * los `URI="..."` dentro de etiquetas, porque `#EXT-X-MAP` apunta al segmento de
 * inicializacion de un HLS en fMP4 y sin token ese pedido vuelve 401. Un URI
 * relativo no hereda la query string del manifiesto que lo contiene, de ahi que
 * haya que escribirla en cada uno.
 */
export function reescribirPlaylist(texto: string, token: string): string {
  return texto
    .split('\n')
    .map((linea) => {
      const limpia = linea.trim();

      if (limpia === '') return linea;

      if (limpia.startsWith('#')) {
        return linea.replace(/URI="([^"]+)"/g, (_todo, uri: string) => `URI="${conToken(uri, token)}"`);
      }

      return conToken(limpia, token);
    })
    .join('\n');
}

function conToken(uri: string, token: string): string {
  const separador = uri.includes('?') ? '&' : '?';
  return `${uri}${separador}token=${encodeURIComponent(token)}`;
}
