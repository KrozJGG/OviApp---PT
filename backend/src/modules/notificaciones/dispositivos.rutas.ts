import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { autenticar } from '../../middleware/autenticar';
import { ctxDe } from '../../shared/contexto';
import { prisma } from '../../shared/db';
import { validarCuerpo, validarParams } from '../../shared/validacion';

/**
 * Registro del token de notificaciones del dispositivo (IF3-SAL, IF4-SAL).
 * La app llama a este endpoint tras iniciar sesion y cada vez que FCM rota el
 * token.
 */
export const enrutadorDispositivosPush = Router();

enrutadorDispositivosPush.use(autenticar);

const esquemaRegistro = z.object({
  tokenPush: z.string().trim().min(10, 'El token de notificaciones no es valido.'),
  plataforma: z.enum(['ANDROID', 'IOS']),
});

enrutadorDispositivosPush.post('/', async (req: Request, res: Response) => {
  const ctx = ctxDe(req);
  const datos = validarCuerpo(esquemaRegistro, req);

  // El mismo token puede migrar de usuario si dos personas usan el equipo:
  // se reasigna en vez de duplicar.
  const dispositivo = await prisma.dispositivoUsuario.upsert({
    where: { tokenPush: datos.tokenPush },
    create: {
      idUsuario: ctx.idUsuario,
      tokenPush: datos.tokenPush,
      plataforma: datos.plataforma,
    },
    update: {
      idUsuario: ctx.idUsuario,
      plataforma: datos.plataforma,
      ultimoUso: new Date(),
    },
    select: { id: true, plataforma: true, ultimoUso: true },
  });

  res.status(201).json(dispositivo);
});

const esquemaToken = z.object({ token: z.string().min(10) });

enrutadorDispositivosPush.delete('/:token', async (req: Request, res: Response) => {
  const ctx = ctxDe(req);
  const { token } = validarParams(esquemaToken, req);

  await prisma.dispositivoUsuario.deleteMany({
    where: { tokenPush: token, idUsuario: ctx.idUsuario },
  });

  res.status(204).end();
});
