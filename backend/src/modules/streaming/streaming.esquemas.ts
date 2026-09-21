import { z } from 'zod';

/**
 * Esquemas del proxy de video en vivo.
 *
 * El nombre del stream y el del archivo llegan por la URL y terminan formando
 * la direccion que se le pide a MediaMTX, asi que se validan con una lista
 * blanca de caracteres: exigir que arranquen con alfanumerico descarta de raiz
 * un ".." que se escaparia un nivel de la ruta interna.
 */

const nombreSeguro = (donde: string) =>
  z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, `El ${donde} solicitado no es valido.`)
    .max(120, `El ${donde} solicitado no es valido.`);

/** POST /streaming/token - el usuario pide permiso para ver una camara. */
export const esquemaTokenStreaming = z.object({
  idDispositivo: z.uuid('El identificador del dispositivo no es valido.'),
});

export type DatosTokenStreaming = z.infer<typeof esquemaTokenStreaming>;

/** GET /streaming/:pathName/:archivo - manifiesto o segmento de video. */
export const esquemaArchivoStream = z.object({
  pathName: nombreSeguro('stream'),
  archivo: nombreSeguro('archivo'),
});

export const esquemaQueryStream = z.object({
  token: z.string().min(1, 'Falta el token de acceso al video.'),
});
