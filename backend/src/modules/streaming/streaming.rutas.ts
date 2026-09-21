import { Router } from 'express';
import { autenticar } from '../../middleware/autenticar';
import * as controlador from './streaming.controlador';

/**
 * Proxy autenticado del video en vivo (IF2-SAL).
 *
 * Conviven dos formas de autenticar sobre el mismo recurso, y es a proposito:
 * pedir acceso exige la sesion del usuario (JWT en la cabecera), pero las
 * peticiones del propio reproductor solo pueden llevar el token en la query,
 * porque las emite el motor de video y no el cliente HTTP de la app.
 */
export const enrutadorStreaming = Router();

// Requiere sesion iniciada. Devuelve la URL del manifiesto ya firmada.
enrutadorStreaming.post('/token', autenticar, controlador.token);

// Las pide el reproductor, sin cabeceras propias: el token viaja en la query y
// lo valida el controlador contra el stream solicitado.
enrutadorStreaming.get('/:pathName/:archivo', controlador.archivo);
